"""Closed native homepage reading projection; substantive records stay gated."""

from core.quotes import random_quote
from meetings.current_reading import current_reading
from meetings.models import ReadingAssignment
from users.access import require_permission
from users.directory import member_summary
from users.membership import spanish_name_key
from users.models import User

from .models import Book


def book_summary(book):
    return {
        "id": str(book.pk),
        "title": book.title,
        "authors": book.authors,
        "coverUrl": book.cover_path or None,
    }


@require_permission("view_club")
def read_home(request):
    book, meeting, week = current_reading()
    next_week = (
        ReadingAssignment.objects.filter(
            meeting=meeting, book_id=meeting.book_id, book__deleted_at__isnull=True
        ).first()
        if meeting
        else None
    )
    members = sorted(
        User.objects.filter(approved=True, revoked_at=None),
        key=lambda member: (spanish_name_key(member.display_name), member.pk),
    )
    done = (
        set(
            week.completions.filter(completed_at__isnull=False).values_list(
                "member_id", flat=True
            )
        )
        if week
        else set()
    )
    return 200, {
        "currentBook": book_summary(book) if book else None,
        "currentWeek": {
            "id": str(week.pk),
            "weekNumber": week.week_number,
            "percentStart": week.percent_start,
            "percentEnd": week.percent_end,
            "pageStart": week.page_start,
            "pageEnd": week.page_end,
            "meetingStartsAt": meeting.starts_at,
            "completedByMe": week.completions.filter(
                member_id=request.user.pk, completed_at__isnull=False
            ).exists(),
        }
        if week
        else None,
        "nextMeeting": {
            "id": str(meeting.pk),
            "startsAt": meeting.starts_at,
            "book": book_summary(meeting.book) if meeting.book_id else None,
            "assignment": {
                "weekNumber": next_week.week_number,
                "percentStart": next_week.percent_start,
                "percentEnd": next_week.percent_end,
                "pageStart": next_week.page_start,
                "pageEnd": next_week.page_end,
            }
            if next_week
            else None,
        }
        if meeting
        else None,
        "memberProgress": [
            {"member": member_summary(member), "completed": member.pk in done}
            for member in members
        ]
        if week
        else [],
        "recentActivity": [],
        "quote": random_quote(),
        "stats": {
            "booksCompleted": Book.objects.filter(status="terminado").count(),
            "reviews": 0,
            "members": User.objects.filter(approved=True, revoked_at=None).count(),
        },
    }
