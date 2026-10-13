"""Closed native homepage reading projection; substantive records stay gated."""

from meetings.current_reading import current_reading
from users.access import require_permission
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
        # #25 owns the next meeting and social progress projections.
        "nextMeeting": None,
        "memberProgress": [],
        "recentActivity": [],
        "quote": None,
        "stats": {
            "booksCompleted": Book.objects.filter(status="terminado").count(),
            "reviews": 0,
            "members": User.objects.filter(approved=True, revoked_at=None).count(),
        },
    }
