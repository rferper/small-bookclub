"""Session-owned idempotent weekly completion, independent from calendar/book state."""

import json

from django.core.exceptions import SuspiciousOperation
from django.db import transaction
from django.utils import timezone

from users.access import permission_refusal, require_permission
from users.membership import error_result, native_member_id
from users.models import User
from users.profile import OWNER_KEYS

from .models import ReadingAssignment, ReadingCompletion


@transaction.atomic
@require_permission(
    "mark_own_progress", context=lambda request, *args: {"owner_id": request.user.pk}
)
def set_completed(request, week_id):
    actor = User.objects.select_for_update().filter(pk=request.user.pk).first()
    refusal = permission_refusal(actor, "mark_own_progress", owner_id=request.user.pk)
    if refusal:
        return error_result(refusal)
    request.user = actor
    # Ownership injection precedes lookup; ordinary malformed input follows it.
    value = None
    try:
        if request.content_type == "application/json" and len(request.body) <= 4096:
            value = json.loads(request.body)
    except (ValueError, UnicodeDecodeError, SuspiciousOperation):
        pass
    if isinstance(value, dict) and any(key.casefold() in OWNER_KEYS for key in value):
        return error_result(403)
    key = native_member_id(week_id)
    assignment = (
        ReadingAssignment.objects.select_for_update()
        .filter(pk=key, book__deleted_at__isnull=True)
        .first()
        if key
        else None
    )
    if assignment is None:
        return error_result(404)
    if (
        not isinstance(value, dict)
        or set(value) != {"completed"}
        or type(value["completed"]) is not bool
    ):
        return error_result(400)
    row, _created = ReadingCompletion.objects.get_or_create(
        assignment=assignment, member=actor
    )
    if value["completed"] != (row.completed_at is not None):
        row.completed_at = timezone.now() if value["completed"] else None
        row.save(update_fields=["completed_at"])
    return 204, None
