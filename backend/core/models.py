"""Reusable soft deletion; domain services own cascades and purge policy."""

from datetime import timedelta
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import models, router, transaction
from django.db.models.functions import Length
from django.db.models.lookups import GreaterThanOrEqual, LessThanOrEqual
from django.utils import timezone

from users.access import is_admin

from .quote_rules import normalize_quote, quote_key

RETENTION = timedelta(days=30)


class RestoreExpired(ValueError):
    """A removed row has reached its strict restoration deadline."""


class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        raise TypeError("Use instance.soft_delete(actor) or explicit hard_delete()")

    def hard_delete(self):
        return super().delete()


class ActiveManager(models.Manager.from_queryset(SoftDeleteQuerySet)):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class SoftDeleteModel(models.Model):
    deleted_at = models.DateTimeField(null=True, blank=True, default=None)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        default=None,
        on_delete=models.PROTECT,
        related_name="%(app_label)s_%(class)s_deletions",
    )
    purge_due_at = models.DateTimeField(null=True, blank=True, default=None)

    objects = ActiveManager()
    all_objects = models.Manager.from_queryset(SoftDeleteQuerySet)()

    class Meta:
        abstract = True
        default_manager_name = "objects"
        base_manager_name = "all_objects"
        constraints = [
            models.CheckConstraint(
                name="%(app_label)s_%(class)s_removal_metadata",
                condition=(
                    models.Q(
                        deleted_at__isnull=True,
                        deleted_by__isnull=True,
                        purge_due_at__isnull=True,
                    )
                    | (
                        models.Q(
                            deleted_at__isnull=False,
                            deleted_by__isnull=False,
                            purge_due_at__isnull=False,
                        )
                        & models.Q(purge_due_at=models.F("deleted_at") + RETENTION)
                    )
                ),
            ),
        ]

    def delete(self, using=None, keep_parents=False):
        raise TypeError("Use soft_delete(actor) or explicit hard_delete()")

    def hard_delete(self, using=None, keep_parents=False):
        """Low-level permanent deletion for authorized purge services only."""
        return super().delete(using=using, keep_parents=keep_parents)

    def _transition(self, actor, *, restore):
        if self._state.adding or self.pk is None:
            raise ValueError("Cannot remove or restore an unsaved row")
        database = router.db_for_write(type(self), instance=self)
        with transaction.atomic(using=database):
            user_model = get_user_model()
            if not isinstance(actor, user_model) or actor._state.adding:
                raise PermissionDenied("Current admin required")
            current_actor = (
                user_model.objects.using(database)
                .select_for_update()
                .filter(pk=actor.pk)
                .first()
            )
            if not is_admin(current_actor):
                raise PermissionDenied("Current admin required")
            current = (
                type(self)
                .all_objects.using(database)
                .select_for_update()
                .get(pk=self.pk)
            )
            now = timezone.now()
            if restore:
                if current.deleted_at is None:
                    return False
                if now >= current.purge_due_at:
                    raise RestoreExpired("Restoration deadline reached")
                current.validate_restore()
                current.deleted_at = current.deleted_by_id = current.purge_due_at = None
            else:
                if current.deleted_at is not None:
                    return False
                current.deleted_at = now
                current.deleted_by = current_actor
                current.purge_due_at = now + RETENTION
            current.save(
                using=database,
                update_fields=["deleted_at", "deleted_by", "purge_due_at"],
            )
            for field in ("deleted_at", "deleted_by_id", "purge_due_at"):
                setattr(self, field, getattr(current, field))
            self._state.fields_cache.pop("deleted_by", None)
        return True

    def soft_delete(self, actor):
        return self._transition(actor, restore=False)

    def restore(self, actor):
        return self._transition(actor, restore=True)

    def validate_restore(self):
        """Override for parent/lifecycle validation inside the transaction."""


class LiteraryQuote(SoftDeleteModel):
    text = models.TextField(max_length=1000)
    author = models.CharField(max_length=200, null=True, blank=True, default=None)
    source = models.CharField(max_length=200, null=True, blank=True, default=None)
    active = models.BooleanField(default=True)
    normalized_text = models.CharField(max_length=1000, unique=True, editable=False)

    class Meta(SoftDeleteModel.Meta):
        constraints = SoftDeleteModel.Meta.constraints + [
            models.CheckConstraint(
                condition=GreaterThanOrEqual(Length("text"), 1)
                & LessThanOrEqual(Length("text"), 1000),
                name="quote_text_length",
            ),
            *[
                models.CheckConstraint(
                    condition=models.Q(**{f"{field}__isnull": True})
                    | LessThanOrEqual(Length(field), 200),
                    name=f"quote_{field}_length",
                )
                for field in ("author", "source")
            ],
        ]

    def normalize(self):
        try:
            values = normalize_quote(
                {
                    field: getattr(self, field)
                    for field in ("text", "author", "source", "active")
                }
            )
        except (ValueError, UnicodeError) as exc:
            raise ValidationError("Los datos de la cita no son válidos.") from exc
        for field, value in values.items():
            setattr(self, field, value)
        self.normalized_text = quote_key(self.text)

    def clean_fields(self, exclude=None):
        self.normalize()
        super().clean_fields(exclude=exclude)

    def save(self, *args, **kwargs):
        self.normalize()
        if kwargs.get("update_fields") and "text" in kwargs["update_fields"]:
            kwargs["update_fields"] = {*kwargs["update_fields"], "normalized_text"}
        return super().save(*args, **kwargs)


class ActivityEvent(models.Model):
    """Protected typed subjects; payload can never carry substantive content."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    kind = models.CharField(max_length=20)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    book = models.ForeignKey("books.Book", null=True, on_delete=models.PROTECT)
    meeting = models.ForeignKey("meetings.Meeting", null=True, on_delete=models.PROTECT)
    vote = models.ForeignKey("votes.Vote", null=True, on_delete=models.PROTECT)
    occurred_at = models.DateTimeField(auto_now_add=True)
    payload = models.JSONField(default=dict)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(payload={}), name="activity_empty_payload"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        kind__in=["book_selected", "review_available"],
                        book__isnull=False,
                        meeting__isnull=True,
                        vote__isnull=True,
                    )
                    | models.Q(
                        kind="nomination_added",
                        book__isnull=False,
                        meeting__isnull=True,
                        vote__isnull=False,
                    )
                    | models.Q(
                        kind__in=["vote_opened", "vote_closed"],
                        book__isnull=True,
                        meeting__isnull=True,
                        vote__isnull=False,
                    )
                    | models.Q(
                        kind="summary_published",
                        book__isnull=True,
                        meeting__isnull=False,
                        vote__isnull=True,
                    )
                ),
                name="activity_typed_subject",
            ),
        ]
