"""Private admin catalogue transport and atomic metadata/cover persistence."""

import json
import re
import uuid
from datetime import date
from pathlib import Path

from django.conf import settings
from django.core.exceptions import SuspiciousOperation, ValidationError
from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.http.multipartparser import MultiPartParser, MultiPartParserError

from core.images import encode_image
from users.access import approved_admin_refusal, require_permission
from users.membership import error_result, native_member_id, spanish_name_key
from users.models import User

from .metadata import MetadataUnavailable, import_cover
from .models import Book

COVER_URL = "/api/media/covers/"
METADATA_FIELDS = {
    "title": "title",
    "authors": "authors",
    "description": "description",
    "publicationDate": "publication_date",
    "publisher": "publisher",
    "isbn": "isbn",
    "pageCount": "page_count",
    "status": "status",
    "datesApproximate": "dates_approximate",
    "readingStartDate": "reading_start_date",
    "readingEndDate": "reading_end_date",
    "plannedStartDate": "planned_start_date",
    "plannedEndDate": "planned_end_date",
}


def projection(book):
    return {
        "id": str(book.pk),
        "coverUrl": book.cover_path or None,
        "originVote": project_origin(book),
        **{wire: getattr(book, field) for wire, field in METADATA_FIELDS.items()},
    }


def project_origin(book):
    # Local import avoids the catalogue/vote model and service import cycle.
    from votes.services import is_visible

    vote = book.origin_vote
    if (
        vote is None
        or vote.status != "closed"
        or vote.winning_book_id != book.pk
        or not is_visible(vote)
    ):
        return None
    return {
        "id": str(vote.pk),
        "label": f"Votación de {vote.curator_assignment.member.display_name}",
    }


def lookup(book_id):
    key = native_member_id(book_id)
    return Book.objects.filter(pk=key).first() if key else None


@require_permission("manage_catalogue")
def list_catalogue(request):
    rows = sorted(
        Book.objects.all(), key=lambda row: (spanish_name_key(row.title), row.pk)
    )
    return 200, [projection(row) for row in rows]


@require_permission("manage_catalogue")
def read_book(request, book_id):
    book = lookup(book_id)
    return (200, projection(book)) if book else error_result(404)


def parse_input(request):
    if not request.content_type.startswith("multipart/form-data"):
        raise ValueError("Invalid media type")
    if request.method == "POST":
        # CSRF may already have parsed the POST body; reuse Django's cached parts.
        fields, files = request.POST, request.FILES
    else:
        fields, files = MultiPartParser(
            request.META, request, request.upload_handlers, request.encoding
        ).parse()
    if set(fields) or not set(files) <= {"metadata", "cover"}:
        raise ValueError("Invalid multipart parts")
    metadata_parts = files.getlist("metadata")
    if len(metadata_parts) != 1:
        raise ValueError("Invalid metadata part")
    part = metadata_parts[0]
    if part.content_type != "application/json" or part.size > 32768:
        raise ValueError("Invalid metadata type/size")
    metadata = json.loads(part.read().decode("utf-8"))
    required = set(METADATA_FIELDS) | {"coverAction"}
    if (
        not isinstance(metadata, dict)
        or not required <= set(metadata)
        or set(metadata) - required - {"metadataResultId"}
    ):
        raise ValueError("Invalid metadata fields")
    action = metadata["coverAction"]
    if not isinstance(action, str) or action not in {
        "keep",
        "remove",
        "replace",
        "metadata",
    }:
        raise ValueError("Invalid cover action")
    if action != "metadata" and "metadataResultId" in metadata:
        raise ValueError("Unsolicited metadata cover reference")
    if action == "metadata" and (
        not isinstance(metadata.get("metadataResultId"), str)
        or not metadata["metadataResultId"]
    ):
        raise ValueError("Missing metadata cover reference")
    covers = files.getlist("cover")
    if len(covers) != (1 if action == "replace" else 0):
        raise ValueError("Invalid cover parts")
    values = {field: metadata[wire] for wire, field in METADATA_FIELDS.items()}
    for field in [
        "reading_start_date",
        "reading_end_date",
        "planned_start_date",
        "planned_end_date",
    ]:
        value = values[field]
        if value is not None:
            if not isinstance(value, str) or not re.fullmatch(
                r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value
            ):
                raise ValueError("Invalid calendar date")
            values[field] = date.fromisoformat(value)
    candidate = Book(**values)
    candidate.full_clean(validate_constraints=False)
    normalized = {
        field: getattr(candidate, field) for field in METADATA_FIELDS.values()
    }
    encoded = encode_image(covers[0]) if covers else None
    return normalized, action, encoded, metadata.get("metadataResultId")


def cover_file(key):
    return Path(settings.MEDIA_ROOT) / "covers" / f"{key}.webp"


def cover_key(url):
    if isinstance(url, str) and url.startswith(COVER_URL):
        key = url[len(COVER_URL) :]
        return key if re.fullmatch(r"[0-9a-f]{32}", key) else None
    return None


def delete_old_cover(key):
    try:
        cover_file(key).unlink(missing_ok=True)
    except OSError:
        pass


@require_permission("manage_catalogue")
def save_book(request, book_id=None):
    actor = request.user
    if book_id is not None and lookup(book_id) is None:
        return error_result(404)
    try:
        values, action, encoded, result_id = parse_input(request)
    except (
        ValueError,
        UnicodeDecodeError,
        ValidationError,
        MultiPartParserError,
        SuspiciousOperation,
    ):
        return error_result(400)
    external_ids = None
    if action == "metadata":
        try:
            imported = import_cover(request, result_id)
        except MetadataUnavailable:
            return error_result(503)
        if imported is None:
            return error_result(404)
        encoded, external_ids = imported
    new_key = uuid.uuid4().hex if encoded is not None else None
    new_file = cover_file(new_key) if new_key else None
    try:
        with transaction.atomic():
            current_actor = User.objects.select_for_update().filter(pk=actor.pk).first()
            refusal = approved_admin_refusal(current_actor)
            if refusal:
                return error_result(refusal)
            book = (
                Book.objects.select_for_update()
                .filter(pk=native_member_id(book_id))
                .first()
                if book_id is not None
                else Book()
            )
            if book is None:
                return error_result(404)
            previously_proposed = book.status == "propuesto"
            for field, value in values.items():
                setattr(book, field, value)
            if external_ids is not None:
                book.external_ids = {**book.external_ids, **external_ids}
            current_reading = (
                Book.objects.filter(status="leyendo").exclude(pk=book.pk).first()
            )
            if book.status == "leyendo" and current_reading:
                status, error = error_result(409)
                error["message"] = (
                    f"Ya se está leyendo «{current_reading.title}». "
                    "Cambia su estado antes de iniciar otro libro."
                )
                return status, error
            old_key = cover_key(book.cover_path)
            if action == "remove" or (action == "metadata" and encoded is None):
                book.cover_path = ""
            elif new_key:
                new_file.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                with new_file.open("xb") as stream:
                    stream.write(encoded)
                book.cover_path = COVER_URL + new_key
            book.full_clean(validate_constraints=False)
            book.save()
            if previously_proposed and book.status in {"elegido", "leyendo"}:
                from core.activity import record_event
                from core.models import ActivityEvent

                if not ActivityEvent.objects.filter(
                    kind="book_selected", book=book
                ).exists():
                    record_event("book_selected", current_actor, book=book)
            result = projection(book)
            if action != "keep" and old_key and old_key != new_key:
                transaction.on_commit(lambda: delete_old_cover(old_key))
        return (201 if book_id is None else 200), result
    except Exception as error:
        if new_file:
            new_file.unlink(missing_ok=True)
        if (
            isinstance(error, IntegrityError)
            and values["status"] == "leyendo"
            and Book.objects.filter(status="leyendo")
            .exclude(pk=native_member_id(book_id) if book_id is not None else None)
            .exists()
        ):
            return error_result(409)
        raise


@require_permission("view_club")
def serve_cover(request, cover_id):
    if (
        not re.fullmatch(r"[0-9a-f]{32}", cover_id)
        or not Book.objects.filter(cover_path=COVER_URL + cover_id).exists()
    ):
        return error_result(404)
    try:
        content = cover_file(cover_id).read_bytes()
    except FileNotFoundError:
        return error_result(404)
    response = HttpResponse(content, content_type="image/webp")
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
