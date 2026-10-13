"""Spoiler-free retained catalogue projection for bookshelf and timeline."""

from meetings.reading_plan import schedule
from users.access import require_permission
from users.membership import error_result

from .catalogue import lookup, projection
from .models import Book


@require_permission("view_club")
def list_books(request):
    return 200, [
        {
            "id": str(book.pk),
            "title": book.title,
            "authors": book.authors,
            "coverUrl": book.cover_path or None,
            "status": book.status,
            "readingStartDate": book.reading_start_date,
            "readingEndDate": book.reading_end_date,
            "datesApproximate": book.dates_approximate,
        }
        for book in Book.objects.all()
    ]


@require_permission("view_club")
def read_book(request, book_id):
    book = lookup(book_id)
    if book is None:
        return error_result(404)
    return 200, {
        **projection(book),
        "schedule": schedule(book, request.user),
        "meetings": [],
    }
