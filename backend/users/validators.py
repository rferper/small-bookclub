import re
import unicodedata
from datetime import datetime

from django.core.exceptions import ValidationError
from django.utils import timezone

DISCORD_ID_PATTERN = r"\A[0-9]{17,20}\Z"


def validate_discord_id(value):
    if not isinstance(value, str) or not re.fullmatch(DISCORD_ID_PATTERN, value):
        raise ValidationError(
            "El ID de Discord debe contener de 17 a 20 dígitos ASCII."
        )


def validate_display_name(value):
    if not isinstance(value, str) or any(
        unicodedata.category(char) in {"Cc", "Cf"} or char in "\u2028\u2029"
        for char in value
    ):
        raise ValidationError(
            "El nombre debe ser texto de una sola línea sin controles."
        )
    if not 1 <= len(value.strip()) <= 40:
        raise ValidationError("El nombre debe contener entre 1 y 40 caracteres.")


def normalize_profile(user):
    # Validate before CharField converts numeric external identities to strings.
    validate_discord_id(user.discord_user_id)
    validate_display_name(user.display_name)
    user.display_name = user.display_name.strip()
    for field in ("bio", "favourite_quote"):
        value = getattr(user, field)
        if value is not None and not isinstance(value, str):
            raise ValidationError({field: "El valor debe ser texto."})
        setattr(user, field, value.strip() or None if value is not None else None)


def validate_membership(user):
    if user.revoked_at is not None and (
        not isinstance(user.revoked_at, datetime) or timezone.is_naive(user.revoked_at)
    ):
        raise ValidationError({"revoked_at": "La fecha debe incluir zona horaria."})
    if user.approved and user.revoked_at is not None:
        raise ValidationError(
            {"approved": "Un miembro revocado no puede estar aprobado."}
        )
