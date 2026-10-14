"""Member calendar metadata and centrally gated published meeting records."""

from django.db.models import Q
from django.utils import timezone

from users.access import can_view_meeting_record, require_permission
from users.directory import member_summary
from users.membership import error_result, native_member_id, spanish_name_key

from .models import Meeting, ReadingAssignment


def visible_meetings():
    return Meeting.objects.filter(
        Q(book__isnull=True) | Q(book__deleted_at__isnull=True)
    )


def active_assignment(meeting):
    return ReadingAssignment.objects.filter(
        meeting=meeting, book_id=meeting.book_id, book__deleted_at__isnull=True
    ).first()


def projection(meeting):
    week = active_assignment(meeting)
    return {
        "id": str(meeting.pk),
        "startsAt": meeting.starts_at,
        "cancelled": meeting.cancelled,
        "book": {
            "id": str(meeting.book.pk),
            "title": meeting.book.title,
            "authors": meeting.book.authors,
            "coverUrl": meeting.book.cover_path or None,
        }
        if meeting.book_id
        else None,
        "assignment": {
            "weekNumber": week.week_number,
            "percentStart": week.percent_start,
            "percentEnd": week.percent_end,
            "pageStart": week.page_start,
            "pageEnd": week.page_end,
        }
        if week
        else None,
    }


@require_permission("view_club")
def list_meetings(request):
    now = timezone.now()
    rows = visible_meetings()
    return 200, {
        "upcoming": [
            projection(row)
            for row in rows.filter(starts_at__gte=now).order_by("starts_at", "pk")
        ],
        "past": [
            projection(row)
            for row in rows.filter(starts_at__lt=now).order_by("-starts_at", "-pk")
        ],
    }


def book_meetings(book):
    result = []
    for row in visible_meetings().filter(book=book).order_by("starts_at", "pk"):
        week = active_assignment(row)
        result.append(
            {
                "id": str(row.pk),
                "startsAt": row.starts_at,
                "cancelled": row.cancelled,
                "weekNumber": week.week_number if week else None,
            }
        )
    return result


def record_access(meeting, actor):
    # Retained links prevent a removed assignment from becoming safe/unlinked.
    week = ReadingAssignment.all_objects.filter(meeting=meeting).first()
    invalid_week = bool(
        week
        and (
            week.deleted_at is not None
            or week.book.deleted_at is not None
            or week.book_id != meeting.book_id
        )
    )
    completed = bool(
        week
        and not invalid_week
        and week.completions.filter(
            member_id=actor.pk, completed_at__isnull=False
        ).exists()
    )
    allowed = can_view_meeting_record(
        actor,
        cancelled=meeting.cancelled,
        linked_week=week is not None,
        week_removed=invalid_week,
        week_completed=completed,
        marked_safe=meeting.record_safe,
    )
    return allowed, week, invalid_week


def record_projection(meeting, actor):
    allowed, week, invalid_week = record_access(meeting, actor)
    if not allowed:
        if week and not invalid_week and not meeting.cancelled:
            return {"status": "lockedWeekNotRead", "weekNumber": week.week_number}
        return {"status": "lockedNoWeek"}
    return {
        "status": "visible",
        "summary": meeting.summary_text if meeting.summary_published else None,
        "highlights": [
            {
                "id": str(row.pk),
                "text": row.text,
                "kind": row.kind,
                "speakers": [
                    member_summary(speaker)
                    for speaker in sorted(
                        row.speakers.all(),
                        key=lambda speaker: (
                            spanish_name_key(speaker.display_name),
                            speaker.pk,
                        ),
                    )
                ],
            }
            for row in meeting.highlights.filter(published=True).order_by(
                "position", "pk"
            )
        ],
    }


@require_permission("view_club")
def read_meeting(request, meeting_id):
    key = native_member_id(meeting_id)
    meeting = visible_meetings().filter(pk=key).first() if key else None
    if meeting is None:
        return error_result(404)
    now = timezone.now()
    attendance = None
    if (
        meeting.starts_at < now
        and not meeting.cancelled
        and meeting.attendance_recorded
    ):
        attendance = [
            member_summary(member)
            for member in sorted(
                meeting.attendees.all(),
                key=lambda row: (spanish_name_key(row.display_name), row.pk),
            )
        ]
    return 200, {
        **projection(meeting),
        "upcoming": meeting.starts_at >= now,
        "attendance": attendance,
        "record": record_projection(meeting, request.user),
    }
