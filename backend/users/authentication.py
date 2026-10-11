"""Server-owned session projection and the finite export handoff for #49."""

import math

from django.contrib.auth import SESSION_KEY, get_user_model, logout
from django.utils import timezone

from .access import is_effective_member

DENIED_KEY = "club_login_denied"
INTENT_KEY = "club_oauth_intent"
PURPOSE_KEY = "club_oauth_purpose"
EXPORT_KEY = "club_export_auth"


def current_identity(request):
    identity = request.user
    if identity.is_authenticated:
        identity = get_user_model().objects.filter(pk=identity.pk).first()
    if identity is not None and is_effective_member(identity):
        request.user = identity
        if identity.role != "admin":
            request.session.pop(EXPORT_KEY, None)
        return identity
    if SESSION_KEY in request.session:
        logout(request)
    request.session.pop(EXPORT_KEY, None)
    return None


def fresh_export_auth(identity, record, now):
    """Pure freshness decision: exactly 300 seconds and future times are invalid."""
    if not is_effective_member(identity) or identity.role != "admin":
        return False
    if not isinstance(record, dict) or record.get("id") != str(identity.pk):
        return False
    stamp = record.get("at")
    if isinstance(stamp, bool) or not isinstance(stamp, (int, float)):
        return False
    return math.isfinite(stamp) and 0 <= now - stamp < 300


def has_fresh_export_auth(request):
    identity = current_identity(request)
    valid = identity is not None and fresh_export_auth(
        identity, request.session.get(EXPORT_KEY), timezone.now().timestamp()
    )
    if not valid:
        request.session.pop(EXPORT_KEY, None)
    return valid
