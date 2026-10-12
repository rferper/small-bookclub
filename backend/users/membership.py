"""Native admin allowlist operations and closed response projection."""

import json
import re
import unicodedata

from django.contrib.auth import SESSION_KEY
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError
from django.db import IntegrityError, models, transaction
from django.utils import timezone

from .access import approved_admin_refusal, is_effective_member
from .authentication import current_identity
from .models import User
from .validators import validate_discord_id, validate_display_name

ERRORS = {
    400: ("invalid_input", "Algunos datos no son válidos."),
    401: ("unauthenticated", "Debes iniciar sesión."),
    403: ("forbidden", "No tienes permiso para esta acción."),
    404: ("not_found", "No se ha encontrado."),
    409: ("conflict", "La acción no está disponible en este estado."),
    500: ("internal_error", "Ha ocurrido un error. Inténtalo de nuevo."),
}


def error_result(status):
    code, message = ERRORS[status]
    return status, {"code": code, "message": message}


def spanish_name_key(name):
    """Stable modern Spanish order without process-global OS locale settings."""
    folded = unicodedata.normalize("NFC", name.casefold())
    primary = []
    for character in folded:
        if character == "ñ":
            primary.append(ord("n") + 0.5)
        else:
            primary.extend(
                ord(part)
                for part in unicodedata.normalize("NFD", character)
                if not unicodedata.combining(part)
            )
    return tuple(primary), folded, name


def admin_members_projection(actor):
    rows = User.objects.filter(
        models.Q(approved=True, revoked_at=None) | models.Q(revoked_at__isnull=False)
    )
    rows = sorted(
        rows,
        key=lambda row: (
            row.revoked_at is not None,
            spanish_name_key(row.display_name),
            row.pk,
        ),
    )
    return {
        "members": [
            {
                "member": {
                    "id": str(row.pk),
                    "displayName": row.display_name,
                    "avatarUrl": row.avatar_path or None,
                },
                "discordId": row.discord_user_id,
                "role": row.role,
                "status": "revoked" if row.revoked_at else "active",
                "addedAt": row.created_at,
                "revokedAt": row.revoked_at,
                "isMe": row.pk == actor.pk,
                "isCurator": False,
            }
            for row in rows
        ],
        "curator": None,
    }


def invalidate_member_sessions(identity):
    """Delete every matching database session, including idle/expired browsers."""
    keys = []
    for session in Session.objects.all().iterator():
        # Match Django auth's native primary-key conversion, including signed
        # server sessions carrying an integer rather than its canonical string.
        try:
            owner = identity._meta.pk.to_python(session.get_decoded().get(SESSION_KEY))
        except ValidationError:
            continue
        if owner == identity.pk:
            keys.append(session.session_key)
    Session.objects.filter(session_key__in=keys).delete()


def new_member_input(value):
    """Pure strict input boundary; no coercion or imported provider profile."""
    if not isinstance(value, dict) or set(value) != {"discordId", "displayName"}:
        raise ValidationError("Invalid member input")
    validate_discord_id(value["discordId"])
    validate_display_name(value["displayName"])
    return value["discordId"], value["displayName"].strip()


def native_member_id(value):
    if not re.fullmatch(r"[0-9]{1,19}", value):
        return None
    number = int(value)
    return number if 0 < number <= 2**63 - 1 else None


def list_members(request):
    actor = current_identity(request)
    refusal = approved_admin_refusal(actor)
    return error_result(refusal) if refusal else (200, admin_members_projection(actor))


@transaction.atomic
def add_member(request):
    actor = current_identity(request)
    refusal = approved_admin_refusal(actor)
    if refusal:
        return error_result(refusal)
    try:
        if request.content_type != "application/json":
            return error_result(400)
        value = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        return error_result(400)
    # Duplicate precedence applies even when the remaining fields are invalid.
    discord_id = value.get("discordId") if isinstance(value, dict) else None
    if (
        isinstance(discord_id, str)
        and User.objects.filter(discord_user_id=discord_id).exists()
    ):
        return error_result(409)
    try:
        discord_id, display_name = new_member_input(value)
    except ValidationError:
        return error_result(400)
    try:
        # Isolate a concurrent unique-key conflict from the outer transaction.
        with transaction.atomic():
            User.objects.create_user(
                discord_id, display_name=display_name, approved=True
            )
    except IntegrityError:
        if User.objects.filter(discord_user_id=discord_id).exists():
            return error_result(409)
        raise
    return 201, admin_members_projection(actor)


@transaction.atomic
def restore_member(request, member_id):
    actor = current_identity(request)
    refusal = approved_admin_refusal(actor)
    if refusal:
        return error_result(refusal)
    native_id = native_member_id(member_id)
    target = (
        User.objects.select_for_update().filter(pk=native_id).first()
        if native_id
        else None
    )
    if target is None:
        return error_result(404)
    if target.revoked_at is None:
        return error_result(409)
    # Remove any sessions made while revoked; restore never authenticates a browser.
    invalidate_member_sessions(target)
    target.approved = True
    target.revoked_at = None
    target.save(update_fields=["approved", "revoked_at", "updated_at"])
    return 200, admin_members_projection(actor)


@transaction.atomic
def revoke_member(request, member_id):
    # Re-read the caller within the operation; request/browser role claims are inert.
    actor = current_identity(request)
    refusal = approved_admin_refusal(actor)
    if refusal:
        return error_result(refusal)
    # The contract accepts opaque IDs. Only bounded ASCII decimal native keys
    # can identify this model; arbitrary strings/huge integers are safe 404s.
    native_id = native_member_id(member_id)
    if native_id is None:
        return error_result(404)
    target = User.objects.select_for_update().filter(pk=native_id).first()
    if target is None:
        return error_result(404)
    if target.pk == actor.pk or not is_effective_member(target):
        return error_result(409)
    target.approved = False
    target.revoked_at = timezone.now()
    target.save(update_fields=["approved", "revoked_at", "updated_at"])
    invalidate_member_sessions(target)
    return 200, admin_members_projection(actor)
