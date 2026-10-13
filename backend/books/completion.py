"""Personal book completion stays independent from weekly progress and reviews."""

import json

from django.core.exceptions import SuspiciousOperation
from django.db import transaction
from django.utils import timezone

from users.access import permission_refusal, require_permission
from users.membership import error_result, native_member_id
from users.models import User
from users.profile import OWNER_KEYS

from .catalogue import lookup
from .models import Book, BookCompletion


def projection(book, actor):
    # Review persistence/gating belongs to #36-#39. Finish alone never unlocks.
    return {
        "book": {
            "id": str(book.pk),
            "title": book.title,
            "authors": book.authors,
            "coverUrl": book.cover_path or None,
        },
        "ratable": book.status in {"leyendo", "terminado", "archivado"},
        "finishedByMe": book.completions.filter(
            member_id=actor.pk, completed_at__isnull=False
        ).exists(),
        "myReview": None,
        "club": {"status": "locked"},
    }


@require_permission("view_club")
def read_completion(request, book_id):
    book = lookup(book_id)
    return (200, projection(book, request.user)) if book else error_result(404)


@transaction.atomic
@require_permission(
    "mark_own_progress", context=lambda request, *args: {"owner_id": request.user.pk}
)
def set_finished(request, book_id):
    actor = User.objects.select_for_update().filter(pk=request.user.pk).first()
    refusal = permission_refusal(actor, "mark_own_progress", owner_id=request.user.pk)
    if refusal:
        return error_result(refusal)
    request.user = actor
    value = None
    try:
        if request.content_type == "application/json" and len(request.body) <= 4096:
            value = json.loads(request.body)
    except (ValueError, UnicodeDecodeError, SuspiciousOperation):
        pass
    if isinstance(value, dict) and any(key.casefold() in OWNER_KEYS for key in value):
        return error_result(403)
    key = native_member_id(book_id)
    book = Book.objects.select_for_update().filter(pk=key).first() if key else None
    if book is None:
        return error_result(404)
    if (
        isinstance(value, dict)
        and value.get("finished") is True
        and book.status not in {"leyendo", "terminado", "archivado"}
    ):
        return error_result(409)
    if (
        not isinstance(value, dict)
        or set(value) != {"finished"}
        or type(value["finished"]) is not bool
    ):
        return error_result(400)
    row, _created = BookCompletion.objects.get_or_create(book=book, member=actor)
    if value["finished"] != (row.completed_at is not None):
        row.completed_at = timezone.now() if value["finished"] else None
        row.save(update_fields=["completed_at"])
    return 200, projection(book, actor)
