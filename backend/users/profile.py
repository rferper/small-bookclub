"""Session-owned native profile updates and private avatar storage."""

import io
import json
import re
import uuid
from pathlib import Path

from django.conf import settings
from django.core.exceptions import SuspiciousOperation, ValidationError
from django.db import transaction
from django.http import HttpResponse
from django.http.multipartparser import MultiPartParser, MultiPartParserError
from PIL import Image, UnidentifiedImageError

from .access import is_effective_member
from .authentication import current_identity
from .membership import error_result
from .models import User
from .validators import validate_display_name

AVATAR_TYPES = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
OWNER_KEYS = {"id", "memberid", "userid", "ownerid", "member", "user", "owner"}
MAX_AVATAR_BYTES = 2 * 1024 * 1024
MAX_METADATA_BYTES = 4096
IMAGE_MAX_PIXELS = 16_000_000
AVATAR_URL = "/api/media/avatars/"


def projection(identity):
    return {
        "member": {
            "id": str(identity.pk),
            "displayName": identity.display_name,
            "avatarUrl": identity.avatar_path or None,
        },
        "bio": identity.bio,
        "favouriteQuote": identity.favourite_quote,
        "favouriteBooks": [],
        "favouriteOptions": [],
    }


def read_profile(request):
    identity = current_identity(request)
    return (
        (200, projection(identity))
        if is_effective_member(identity)
        else error_result(401)
    )


def text_value(value, limit):
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Invalid profile text")
    trimmed = value.strip()
    if len(trimmed) > limit or "\x00" in trimmed:
        raise ValueError("Invalid profile text")
    return trimmed or None


def parse_input(request):
    if not request.content_type.startswith("multipart/form-data"):
        raise ValueError("Invalid media type")
    fields, files = MultiPartParser(
        request.META, request, request.upload_handlers, request.encoding
    ).parse()
    parts = set(fields) | set(files)
    if any(key.casefold() in OWNER_KEYS for key in parts):
        return 403, None
    if not parts <= {"metadata", "avatar"} or "metadata" not in parts:
        raise ValueError("Invalid multipart parts")
    metadata_parts = files.getlist("metadata")
    if fields.getlist("metadata") or len(metadata_parts) != 1:
        raise ValueError("Invalid metadata part")
    metadata_part = metadata_parts[0]
    if (
        metadata_part.content_type != "application/json"
        or metadata_part.size > MAX_METADATA_BYTES
    ):
        raise ValueError("Invalid metadata type or size")
    metadata = json.loads(metadata_part.read().decode("utf-8"))
    if not isinstance(metadata, dict):
        raise ValueError("Invalid metadata")
    if any(key.casefold() in OWNER_KEYS for key in metadata):
        return 403, None
    if set(metadata) - {
        "displayName",
        "bio",
        "favouriteQuote",
        "favouriteBookIds",
        "avatarAction",
    }:
        raise ValueError("Unknown field")
    name = metadata.get("displayName")
    validate_display_name(name)
    favourites = metadata.get("favouriteBookIds")
    if favourites != []:
        # The book catalogue is introduced in its own issue.
        raise ValueError("Unavailable favourite books")
    action = metadata.get("avatarAction")
    if not isinstance(action, str) or action not in {"keep", "remove", "replace"}:
        raise ValueError("Invalid avatar action")
    avatars = files.getlist("avatar")
    if fields.getlist("avatar") or len(avatars) != (1 if action == "replace" else 0):
        raise ValueError("Invalid avatar part")
    encoded = encode_avatar(avatars[0]) if avatars else None
    return 200, (
        name.strip(),
        text_value(metadata.get("bio"), 500),
        text_value(metadata.get("favouriteQuote"), 300),
        action,
        encoded,
    )


def encode_avatar(upload):
    if (
        upload.content_type not in AVATAR_TYPES
        or not 0 < upload.size <= MAX_AVATAR_BYTES
    ):
        raise ValueError("Invalid avatar upload")
    data = upload.read(MAX_AVATAR_BYTES + 1)
    if not 0 < len(data) <= MAX_AVATAR_BYTES:
        raise ValueError("Invalid avatar size")
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.format != AVATAR_TYPES[upload.content_type]:
                raise ValueError("Image type mismatch")
            if source.width * source.height > IMAGE_MAX_PIXELS:
                raise ValueError("Image dimensions too large")
            source.load()
            image = source.convert("RGBA" if "A" in source.getbands() else "RGB")
            output = io.BytesIO()
            image.save(output, format="WEBP", quality=85)
            return output.getvalue()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise ValueError("Invalid image data") from error


def avatar_file(key):
    return Path(settings.MEDIA_ROOT) / "avatars" / f"{key}.webp"


def stored_avatar_key(url):
    if isinstance(url, str) and url.startswith(AVATAR_URL):
        key = url[len(AVATAR_URL) :]
        if re.fullmatch(r"[0-9a-f]{32}", key):
            return key
    return None


def delete_old_avatar(key):
    # A cleanup error after database commit must not turn a successful save
    # into a 500 or remove the new image now referenced by the profile.
    try:
        avatar_file(key).unlink(missing_ok=True)
    except OSError:
        pass


def update_profile(request):
    actor = current_identity(request)
    if not is_effective_member(actor):
        return error_result(401)
    try:
        status, values = parse_input(request)
    except (
        ValueError,
        UnicodeDecodeError,
        ValidationError,
        MultiPartParserError,
        SuspiciousOperation,
    ):
        return error_result(400)
    if status == 403:
        return error_result(403)
    name, bio, quote, action, encoded = values
    new_key = uuid.uuid4().hex if encoded is not None else None
    new_file = avatar_file(new_key) if new_key else None
    try:
        with transaction.atomic():
            identity = User.objects.select_for_update().get(pk=actor.pk)
            if not is_effective_member(identity):
                return error_result(401)
            old_key = stored_avatar_key(identity.avatar_path)
            identity.display_name = name
            identity.bio = bio
            identity.favourite_quote = quote
            if action == "remove":
                identity.avatar_path = ""
            elif new_key:
                new_file.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                with new_file.open("xb") as stream:
                    stream.write(encoded)
                identity.avatar_path = AVATAR_URL + new_key
            identity.full_clean()
            identity.save(
                update_fields=[
                    "display_name",
                    "bio",
                    "favourite_quote",
                    "avatar_path",
                    "updated_at",
                ]
            )
            result = projection(identity)
            if action != "keep" and old_key and old_key != new_key:
                transaction.on_commit(lambda: delete_old_avatar(old_key))
        return 200, result
    except Exception:
        if new_file:
            new_file.unlink(missing_ok=True)
        raise


def serve_avatar(request, avatar_id):
    identity = current_identity(request)
    if not is_effective_member(identity):
        return error_result(401)
    if not re.fullmatch(r"[0-9a-f]{32}", avatar_id):
        return error_result(404)
    if not User.objects.filter(
        approved=True, revoked_at=None, avatar_path=AVATAR_URL + avatar_id
    ).exists():
        return error_result(404)
    try:
        content = avatar_file(avatar_id).read_bytes()
    except FileNotFoundError:
        return error_result(404)
    response = HttpResponse(content, content_type="image/webp")
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
