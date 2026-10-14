"""Native statistics input collection: gate before querying foreign scores."""

from django.utils import timezone

from books.models import Book, BookCompletion
from meetings.member_calendar import visible_meetings
from users.access import can_view_reviews, require_permission
from users.directory import member_summary
from users.models import User

from .compatibility import taste_compatibility
from .constants import CRITERIA
from .models import Review
from .statistics import (
    BOOK_RATINGS_THRESHOLD,
    MEMBER_RATINGS_THRESHOLD,
    activity_counts,
    rating_statistics,
)


def permitted_rating_inputs(actor):
    finished = set(
        BookCompletion.objects.filter(
            member=actor, completed_at__isnull=False, book__deleted_at__isnull=True
        ).values_list("book_id", flat=True)
    )
    own = set(
        Review.objects.filter(member=actor, book__deleted_at__isnull=True).values_list(
            "book_id", flat=True
        )
    )
    permitted = [
        book_id
        for book_id in own
        if can_view_reviews(
            actor, personally_finished=book_id in finished, own_review_submitted=True
        )
    ]
    books = [
        {
            "id": str(book.pk),
            "title": book.title,
            "authors": book.authors,
            "coverUrl": book.cover_path or None,
        }
        for book in Book.objects.filter(pk__in=permitted).order_by("pk")
    ]
    # Recheck retained parent in this query, and never load review text.
    rows = list(
        Review.objects.filter(book_id__in=permitted, book__deleted_at__isnull=True)
        .select_related("member")
        .only(
            "book_id",
            "member_id",
            *CRITERIA,
            "member__display_name",
            "member__avatar_path",
        )
    )
    return books, rows


@require_permission("view_club")
def read_compatibility(request):
    actor = request.user
    books, rows = permitted_rating_inputs(actor)
    members = User.objects.filter(approved=True, revoked_at__isnull=True).order_by("pk")
    return 200, taste_compatibility(
        reviews=[
            {
                "bookId": str(row.book_id),
                "memberId": str(row.member_id),
                "scores": row.scores,
            }
            for row in rows
        ],
        books=books,
        members=[member_summary(member) for member in members],
        viewer_id=str(actor.pk),
    )


@require_permission("view_club")
def read_statistics(request):
    actor = request.user
    books, rows = permitted_rating_inputs(actor)
    # Retain attributed review history even after a reviewer loses membership.
    identities = {row.member_id: row.member for row in rows}
    counts = activity_counts(
        books=Book.objects.values("status"),
        meetings=(
            {"dateTime": row.starts_at, "cancelled": row.cancelled}
            for row in visible_meetings().only("starts_at", "cancelled")
        ),
        now=timezone.now(),
    )
    return 200, {
        **counts,
        "thresholds": {
            "bookRatings": BOOK_RATINGS_THRESHOLD,
            "memberRatings": MEMBER_RATINGS_THRESHOLD,
        },
        "ratings": rating_statistics(
            reviews=[
                {
                    "bookId": str(row.book_id),
                    "memberId": str(row.member_id),
                    "scores": row.scores,
                }
                for row in rows
            ],
            books=books,
            members=[member_summary(member) for member in identities.values()],
            viewer_id=str(actor.pk),
        ),
    }
