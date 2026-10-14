"""Current-session review create/edit, after personal completion."""

import json

from django.core.exceptions import SuspiciousOperation, ValidationError
from django.db import transaction
from django.utils import timezone

from books.completion import projection
from books.models import Book, BookCompletion
from users.access import permission_refusal, require_permission
from users.membership import error_result, native_member_id
from users.models import User
from users.profile import OWNER_KEYS

from .constants import CRITERIA
from .math import validated_scores
from .models import Review


def payload(request):
    try:
        if request.content_type == "application/json" and len(request.body) <= 65536:
            return json.loads(request.body)
    except (ValueError, UnicodeError, SuspiciousOperation):
        pass
    return None


@transaction.atomic
@require_permission(
    "edit_own_review", context=lambda request, *args: {"owner_id": request.user.pk}
)
def save_review(request, book_id):
    actor = User.objects.select_for_update().filter(pk=request.user.pk).first()
    refusal = permission_refusal(actor, "edit_own_review", owner_id=request.user.pk)
    if refusal:
        return error_result(refusal)
    request.user = actor
    value = payload(request)
    if isinstance(value, dict) and any(key.casefold() in OWNER_KEYS for key in value):
        return error_result(403)
    key = native_member_id(book_id)
    book = Book.objects.select_for_update().filter(pk=key).first() if key else None
    if book is None:
        return error_result(404)
    if (
        book.status not in {"leyendo", "terminado", "archivado"}
        or not BookCompletion.objects.select_for_update()
        .filter(book=book, member=actor, completed_at__isnull=False)
        .exists()
    ):
        return error_result(409)
    if (
        not isinstance(value, dict)
        or "scores" not in value
        or set(value) - {"scores", "text"}
    ):
        return error_result(400)
    row = Review.objects.select_for_update().filter(book=book, member=actor).first()
    editing = row is not None
    if not editing:
        row = Review(book=book, member=actor)
    try:
        cleaned = validated_scores(value["scores"])
        for criterion in CRITERIA:
            setattr(row, criterion, cleaned[criterion])
        row.text = value.get("text")
        row.edited_at = timezone.now() if editing else None
        row.full_clean()
    except (ValueError, ValidationError):
        return error_result(400)
    row.save()
    if not editing:
        from core.activity import record_event

        record_event("review_available", actor, book=book)
    return 200, projection(book, actor)
