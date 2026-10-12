"""Native revocation operation, reusable by later allowlist management."""

import re
import unicodedata

from django.contrib.auth import SESSION_KEY
from django.contrib.sessions.models import Session
from django.db import models, transaction
from django.utils import timezone

from .access import approved_admin_refusal, is_effective_member
from .authentication import current_identity
from .models import User

ERRORS = {
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
    keys = [
        session.session_key
        for session in Session.objects.all().iterator()
        if session.get_decoded().get(SESSION_KEY) == str(identity.pk)
    ]
    Session.objects.filter(session_key__in=keys).delete()


@transaction.atomic
def revoke_member(request, member_id):
    # Re-read the caller within the operation; request/browser role claims are inert.
    actor = current_identity(request)
    refusal = approved_admin_refusal(actor)
    if refusal:
        return error_result(refusal)
    # The contract accepts opaque IDs. Only bounded ASCII decimal native keys
    # can identify this model; arbitrary strings/huge integers are safe 404s.
    if not re.fullmatch(r"[0-9]{1,19}", member_id):
        return error_result(404)
    native_id = int(member_id)
    if not 0 < native_id <= 2**63 - 1:
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
