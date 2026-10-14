"""Safe active-parent preference summaries for profile and privileged export."""

from books.models import Book

from .membership import native_member_id, spanish_name_key
from .models import FavouriteBook


def selected(identity):
    from books.home import book_summary

    return [
        book_summary(row.book)
        for row in FavouriteBook.objects.filter(
            member=identity, book__deleted_at__isnull=True
        )
        .select_related("book")
        .order_by("rank", "pk")
    ]


def options():
    from books.home import book_summary

    return [
        book_summary(book)
        for book in sorted(
            Book.objects.filter(status__in=["terminado", "archivado"]),
            key=lambda row: (spanish_name_key(row.title), row.pk),
        )
    ]


def selection_ids(value):
    if not isinstance(value, list) or len(value) > 5:
        raise ValueError("Invalid favourite list")
    ids = [native_member_id(key) if isinstance(key, str) else None for key in value]
    if any(key is None for key in ids) or len(set(ids)) != len(ids):
        raise ValueError("Invalid favourite IDs")
    return ids
