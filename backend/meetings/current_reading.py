"""Shared server-owned current target, independent from completion and due dates."""

from django.db.models import Q
from django.utils import timezone

from books.models import Book

from .models import Meeting, ReadingAssignment


def current_reading(now=None):
    now = timezone.now() if now is None else now
    book = Book.objects.filter(status="leyendo").first()
    meeting = (
        Meeting.objects.filter(cancelled=False, starts_at__gte=now)
        .filter(Q(book__isnull=True) | Q(book__deleted_at__isnull=True))
        .order_by("starts_at", "pk")
        .first()
    )
    week = (
        ReadingAssignment.objects.filter(book=book, meeting=meeting).first()
        if book is not None and meeting is not None
        else None
    )
    return book, meeting, week
