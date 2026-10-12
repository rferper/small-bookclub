"""Admin calendar metadata and atomic row-local lifecycle operations."""

import json
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.exceptions import SuspiciousOperation, ValidationError
from django.db import transaction
from django.utils import timezone

from books.models import Book
from users.access import approved_admin_refusal, require_permission
from users.directory import member_summary
from users.membership import error_result, native_member_id, spanish_name_key
from users.models import User

from .models import Meeting
from .time_rules import attendance_eligible, parse_instant


def lookup(meeting_id, *, lock=False):
    key = native_member_id(meeting_id)
    rows = Meeting.objects.select_for_update() if lock else Meeting.objects.all()
    return rows.filter(pk=key).first() if key else None


def locked_actor_refusal(request):
    actor = User.objects.select_for_update().filter(pk=request.user.pk).first()
    refusal = approved_admin_refusal(actor)
    if not refusal:
        request.user = actor
    return refusal


def projection(meeting, now):
    attendance = None
    if meeting.attendance_recorded:
        attendance = [
            member_summary(member)
            for member in sorted(
                meeting.attendees.all(),
                key=lambda member: (spanish_name_key(member.display_name), member.pk),
            )
        ]
    return {
        "id": str(meeting.pk),
        "startsAt": meeting.starts_at,
        "bookId": str(meeting.book_id) if meeting.book_id else None,
        "weekId": None,
        "cancelled": meeting.cancelled,
        "upcoming": meeting.starts_at >= now,
        "attendance": attendance,
        "attendanceEligible": attendance_eligible(
            meeting.starts_at, meeting.cancelled, now
        ),
    }


@require_permission("manage_meetings")
def list_calendar(request):
    now = timezone.now()
    rows = list(Meeting.objects.prefetch_related("attendees"))
    upcoming = sorted(
        [row for row in rows if row.starts_at >= now],
        key=lambda row: (row.starts_at, row.pk),
    )
    past = sorted(
        [row for row in rows if row.starts_at < now],
        key=lambda row: (-row.starts_at.timestamp(), row.pk),
    )
    return 200, {
        "clubTimezone": settings.TIME_ZONE,
        "upcoming": [projection(row, now) for row in upcoming],
        "past": [projection(row, now) for row in past],
        "books": [
            {"id": str(book.pk), "title": book.title} for book in Book.objects.all()
        ],
        "weeks": [],
        "activeMembers": [
            member_summary(member)
            for member in sorted(
                User.objects.filter(approved=True, revoked_at=None),
                key=lambda row: (spanish_name_key(row.display_name), row.pk),
            )
        ],
    }


@require_permission("manage_meetings")
def read_meeting(request, meeting_id):
    meeting = lookup(meeting_id)
    return (200, projection(meeting, timezone.now())) if meeting else error_result(404)


def json_input(request, keys):
    if request.content_type != "application/json":
        raise ValueError("Invalid media type")
    body = request.body
    if len(body) > 4096:
        raise ValueError("Meeting input too large")
    value = json.loads(body)
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError("Invalid meeting input")
    return value


@transaction.atomic
@require_permission("manage_meetings")
def save_meeting(request, meeting_id=None):
    refusal = locked_actor_refusal(request)
    if refusal:
        return error_result(refusal)
    meeting = lookup(meeting_id, lock=True) if meeting_id is not None else Meeting()
    if meeting is None:
        return error_result(404)
    try:
        value = json_input(request, {"startsAt", "bookId", "weekId"})
        for field in ("bookId", "weekId"):
            if value[field] is not None and (
                not isinstance(value[field], str) or not value[field]
            ):
                raise ValueError("Invalid link")
    except (ValueError, UnicodeDecodeError, SuspiciousOperation):
        return error_result(400)
    book_id = native_member_id(value["bookId"]) if value["bookId"] is not None else None
    retained = book_id is not None and book_id == meeting.book_id
    if value["bookId"] is not None and not (
        retained or (book_id and Book.objects.filter(pk=book_id).exists())
    ):
        return error_result(404)
    if value["weekId"] is not None:
        return error_result(404)  # Canonical reading reservations are #21.
    try:
        meeting.starts_at = parse_instant(value["startsAt"], settings.TIME_ZONE)
        meeting.book_id = book_id
        meeting.full_clean()
    except (ValueError, ValidationError):
        return error_result(400)
    if meeting_id is None:
        meeting.save()
    else:
        meeting.save(update_fields=["starts_at", "book", "updated_at"])
    return (201 if meeting_id is None else 200), projection(meeting, timezone.now())


@transaction.atomic
@require_permission("manage_meetings")
def set_cancelled(request, meeting_id):
    refusal = locked_actor_refusal(request)
    if refusal:
        return error_result(refusal)
    meeting = lookup(meeting_id, lock=True)
    if meeting is None:
        return error_result(404)
    try:
        value = json_input(request, {"cancelled"})
        if type(value["cancelled"]) is not bool:
            raise ValueError("Invalid cancelled flag")
    except (ValueError, UnicodeDecodeError, SuspiciousOperation):
        return error_result(400)
    meeting.cancelled = value["cancelled"]
    meeting.save(update_fields=["cancelled", "updated_at"])
    return 200, projection(meeting, timezone.now())


def safe_label(kind, row):
    if kind == "book":
        return row.title
    local = timezone.localtime(row.starts_at, ZoneInfo(settings.TIME_ZONE))
    return "Reunión del " + local.strftime("%d/%m/%Y %H:%M")


def dependencies(kind, row):
    if kind == "book":
        count = Meeting.all_objects.filter(book_id=row.pk).count()
        return [f"{count} reuniones vinculadas"] if count else []
    count = row.attendees.count()
    return [f"{count} registros de asistencia conservados"] if count else []


@require_permission("manage_meetings")
def deletion_preview(request, kind, resource_id):
    if kind not in {"book", "meeting", "quote"}:
        return error_result(400)
    key = native_member_id(resource_id)
    model = {"book": Book, "meeting": Meeting}.get(kind)
    row = model.objects.filter(pk=key).first() if model and key else None
    if row is None:
        return error_result(404)
    return 200, {
        "label": safe_label(kind, row),
        "dependencies": dependencies(kind, row),
    }


def bin_projection():
    now = timezone.now()
    rows = []
    for kind, model in [("book", Book), ("meeting", Meeting)]:
        for row in model.all_objects.filter(deleted_at__isnull=False).select_related(
            "deleted_by"
        ):
            rows.append(
                {
                    "type": kind,
                    "id": str(row.pk),
                    "label": safe_label(kind, row),
                    "deletedAt": row.deleted_at,
                    "deletedByName": row.deleted_by.display_name,
                    "purgeDueAt": row.purge_due_at,
                    "expired": now >= row.purge_due_at,
                    "dependencies": dependencies(kind, row),
                }
            )
    return sorted(
        rows, key=lambda row: (-row["deletedAt"].timestamp(), row["type"], row["id"])
    )


@transaction.atomic
@require_permission("manage_meetings")
def remove_meeting(request, meeting_id):
    refusal = locked_actor_refusal(request)
    if refusal:
        return error_result(refusal)
    meeting = lookup(meeting_id, lock=True)
    if meeting is None:
        return error_result(404)
    meeting.soft_delete(request.user)
    return 200, bin_projection()
