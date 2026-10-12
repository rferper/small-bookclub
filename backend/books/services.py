"""Transactional catalogue status decisions; HTTP adapters are separate issues."""

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction

from users.access import is_admin

from .models import Book


class ActiveBookConflict(ValueError):
    """The current reading book must be changed explicitly first."""


@transaction.atomic
def set_book_status(actor, book_id, status):
    user_model = get_user_model()
    if not isinstance(actor, user_model) or actor._state.adding:
        raise PermissionDenied("Current admin required")
    current_actor = user_model.objects.select_for_update().filter(pk=actor.pk).first()
    if not is_admin(current_actor):
        raise PermissionDenied("Current admin required")
    book = Book.objects.select_for_update().get(pk=book_id)
    if not isinstance(status, str) or status not in Book.Status.values:
        raise ValidationError("El estado no es válido.")
    book.status = status
    book.full_clean(validate_constraints=False)
    try:
        with transaction.atomic():
            book.save(update_fields=["status", "updated_at"])
    except IntegrityError:
        if (
            status == Book.Status.READING
            and Book.objects.filter(status=Book.Status.READING)
            .exclude(pk=book.pk)
            .exists()
        ):
            raise ActiveBookConflict("Ya hay un libro en lectura.") from None
        raise
    return book
