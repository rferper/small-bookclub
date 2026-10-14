"""Atomic business events and closed, currently authorized Home projections."""

from .models import ActivityEvent

RECENT_LIMIT = 10


def record_event(kind, actor, *, book=None, meeting=None, vote=None):
    # Called only inside the corresponding successful business transaction.
    ActivityEvent.objects.create(
        kind=kind, actor=actor, book=book, meeting=meeting, vote=vote
    )


def recent_activity(actor):
    # Local imports avoid cycles with services that record their own events.
    from meetings.member_calendar import record_access
    from reviews.statistics_services import permitted_book_ids
    from votes.services import is_visible

    permitted = set(permitted_book_ids(actor))
    rows = (
        ActivityEvent.objects.select_related("book", "meeting__book", "vote")
        .only(
            "id",
            "kind",
            "occurred_at",
            "book_id",
            "meeting_id",
            "vote_id",
            "book__title",
            "book__deleted_at",
            "meeting__book_id",
            "meeting__deleted_at",
            "meeting__summary_published",
            "meeting__record_safe",
            "meeting__cancelled",
            "meeting__book__deleted_at",
            "vote__id",
        )
        .order_by("-occurred_at", "-pk")
    )
    result = []
    for row in rows.iterator():
        if row.book_id and row.book.deleted_at is not None:
            continue
        if row.vote_id and not is_visible(row.vote):
            continue
        if row.kind == "review_available" and row.book_id not in permitted:
            continue
        if row.kind == "summary_published":
            meeting = row.meeting
            if (
                meeting.deleted_at is not None
                or (meeting.book_id and meeting.book.deleted_at is not None)
                or not meeting.summary_published
                or not record_access(meeting, actor)[0]
            ):
                continue
        text = {
            "vote_opened": "Se ha abierto una votación.",
            "vote_closed": "Se ha cerrado una votación.",
            "summary_published": "Se ha publicado el resumen de una reunión.",
        }.get(row.kind)
        if text is None:
            title = row.book.title
            text = {
                "book_selected": f"Se ha elegido «{title}» para leer en el club.",
                "nomination_added": f"Se ha propuesto «{title}» en una votación.",
                "review_available": f"Hay una nueva valoración de «{title}».",
            }[row.kind]
        result.append(
            {
                "id": str(row.pk),
                "type": row.kind,
                "occurredAt": row.occurred_at,
                "text": text,
            }
        )
        if len(result) == RECENT_LIMIT:
            break
    return result
