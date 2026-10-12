"""Spoiler-free retained catalogue projection for bookshelf and timeline."""

from users.access import require_permission

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
