"""Atomic admin attendance replacement retaining revoked historical attendees."""

import json

from django.core.exceptions import SuspiciousOperation
from django.db import transaction
from django.utils import timezone

from users.access import require_permission
from users.membership import error_result, native_member_id
from users.models import User

from .calendar import locked_actor_refusal, lookup, projection
from .time_rules import attendance_eligible


@transaction.atomic
@require_permission("manage_meetings")
def set_attendance(request, meeting_id):
    refusal = locked_actor_refusal(request)
    if refusal:
        return error_result(refusal)
    meeting = lookup(meeting_id, lock=True)
    if meeting is None:
        return error_result(404)
    now = timezone.now()
    if not attendance_eligible(meeting.starts_at, meeting.cancelled, now):
        return error_result(409)
    value = None
    try:
        if request.content_type == "application/json" and len(request.body) <= 4096:
            value = json.loads(request.body)
    except (ValueError, UnicodeDecodeError, SuspiciousOperation):
        pass
    if not isinstance(value, dict) or set(value) != {"memberIds"}:
        return error_result(400)
    ids = value["memberIds"]
    if (
        not isinstance(ids, list)
        or len(ids) > 100
        or any(not isinstance(key, str) or not native_member_id(key) for key in ids)
    ):
        return error_result(400)
    keys = [native_member_id(key) for key in ids]
    if len(set(keys)) != len(keys):
        return error_result(400)
    selected = list(
        User.objects.select_for_update().filter(
            pk__in=keys, approved=True, revoked_at=None
        )
    )
    if len(selected) != len(keys):
        return error_result(400)
    historical = list(meeting.attendees.filter(revoked_at__isnull=False))
    meeting.attendees.set([*selected, *historical])
    meeting.attendance_recorded = True
    meeting.save(update_fields=["attendance_recorded", "updated_at"])
    return 200, projection(meeting, now)
