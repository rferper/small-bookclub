"""Admin-only canonical recovery and conservative, row-local permanent purge."""

from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.utils import timezone

from books.catalogue import cover_key, delete_old_cover
from books.models import Book
from meetings.calendar import bin_projection, locked_actor_refusal
from meetings.models import Meeting, MeetingHighlight, ReadingAssignment
from users.access import require_permission
from users.membership import error_result, native_member_id

from .models import ActivityEvent, LiteraryQuote, PurgeRecord, RestoreExpired

MODELS = {
    "book": Book,
    "meeting": Meeting,
    "week": ReadingAssignment,
    "highlight": MeetingHighlight,
    "quote": LiteraryQuote,
}


class RestoreConflict(ValueError):
    pass


@require_permission("restore_content")
def list_bin(request):
    return 200, bin_projection()


@transaction.atomic
@require_permission("manage_catalogue")
def remove_book(request, resource_id):
    refusal = locked_actor_refusal(request)
    if refusal:
        return error_result(refusal)
    key = native_member_id(resource_id)
    row = Book.objects.select_for_update().filter(pk=key).first() if key else None
    if row is None:
        return error_result(404)
    row.soft_delete(request.user)
    return 200, bin_projection()


def deleted_target(kind, resource_id):
    model = MODELS.get(kind)
    if model is None:
        return None, error_result(400)
    key = native_member_id(resource_id)
    row = (
        model.all_objects.select_for_update()
        .filter(pk=key, deleted_at__isnull=False)
        .first()
        if key
        else None
    )
    return (row, None) if row else (None, error_result(404))


def parent_book(book_id):
    if not Book.objects.select_for_update().filter(pk=book_id).exists():
        raise RestoreConflict("Restore the parent book first")


def parent_meeting(meeting_id):
    row = Meeting.objects.select_for_update().filter(pk=meeting_id).first()
    if row is None:
        raise RestoreConflict("Restore the parent meeting first")
    if row.book_id:
        parent_book(row.book_id)
    return row


def validate_restore(kind, row):
    if kind == "meeting":
        if row.book_id:
            parent_book(row.book_id)
        if (
            ReadingAssignment.all_objects.filter(meeting=row)
            .exclude(book_id=row.book_id)
            .exists()
        ):
            raise RestoreConflict("Invalid retained assignment link")
    elif kind == "week":
        parent_book(row.book_id)
        if row.meeting_id and parent_meeting(row.meeting_id).book_id != row.book_id:
            raise RestoreConflict("Invalid same-book link")
    elif kind == "highlight":
        parent_meeting(row.meeting_id)


def restore_week(row, actor):
    rows = list(
        ReadingAssignment.objects.select_for_update()
        .filter(book_id=row.book_id)
        .order_by("week_number", "pk")
    )
    rows.insert(max(0, min(row.week_number - 1, len(rows))), row)
    offset = max(
        (item.week_number for item in rows if item.pk != row.pk), default=0
    ) + len(rows)
    for index, item in enumerate(rows, 1):
        ReadingAssignment.all_objects.filter(pk=item.pk).update(
            week_number=offset + index
        )
    for index, item in enumerate(rows, 1):
        ReadingAssignment.all_objects.filter(pk=item.pk).update(week_number=index)
    row.restore(actor)


@transaction.atomic
@require_permission("restore_content")
def restore_deleted(request, kind, resource_id):
    refusal = locked_actor_refusal(request)
    if refusal:
        return error_result(refusal)
    row, failure = deleted_target(kind, resource_id)
    if failure:
        return failure
    try:
        with transaction.atomic():
            if timezone.now() >= row.purge_due_at:
                raise RestoreExpired
            validate_restore(kind, row)
            if kind == "week":
                restore_week(row, request.user)
            else:
                row.restore(request.user)
    except (RestoreExpired, RestoreConflict, IntegrityError):
        return error_result(409)
    return 200, bin_projection()


def purge_blocked(kind, row):
    if kind == "book":
        return (
            ReadingAssignment.all_objects.filter(book=row).exists()
            or Meeting.all_objects.filter(book=row).exists()
            or row.reviews.exists()
            or row.completions.exists()
            or row.vote_candidacies.exists()
            or row.won_votes.exists()
            or row.origin_vote_id is not None
            or ActivityEvent.objects.filter(book=row).exists()
        )
    if kind == "meeting":
        return (
            ReadingAssignment.all_objects.filter(meeting=row).exists()
            or row.attendees.exists()
            or MeetingHighlight.all_objects.filter(meeting=row).exists()
            or ActivityEvent.objects.filter(meeting=row).exists()
        )
    if kind == "week":
        return row.meeting_id is not None or row.completions.exists()
    return False


def purge_target(kind, row, actor):
    """Shared transaction-only primitive; protects every retained dependency."""
    if purge_blocked(kind, row):
        return False
    key = cover_key(row.cover_path) if kind == "book" else None
    with transaction.atomic():
        PurgeRecord.objects.create(kind=kind, resource_id=str(row.pk), actor=actor)
        if kind == "highlight":
            row.speakers.clear()
        row.hard_delete()
        if key:
            transaction.on_commit(lambda: delete_old_cover(key))
    return True


@transaction.atomic
@require_permission("restore_content")
def purge_deleted(request, kind, resource_id):
    refusal = locked_actor_refusal(request)
    if refusal:
        return error_result(refusal)
    row, failure = deleted_target(kind, resource_id)
    if failure:
        return failure
    try:
        if not purge_target(kind, row, request.user):
            return error_result(409)
    except (IntegrityError, ProtectedError):
        return error_result(409)
    return 200, bin_projection()
