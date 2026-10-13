"""Retained calendar records; substantive meeting content stays private."""

from datetime import datetime

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from core.models import SoftDeleteModel

from .reading_rules import MAX_SAFE_INTEGER


class Meeting(SoftDeleteModel):
    book = models.ForeignKey(
        "books.Book",
        null=True,
        blank=True,
        default=None,
        on_delete=models.PROTECT,
        related_name="meetings",
    )
    starts_at = models.DateTimeField()
    cancelled = models.BooleanField(default=False)
    summary_text = models.TextField(
        max_length=10000, null=True, blank=True, default=None
    )
    summary_published = models.BooleanField(default=False)
    record_safe = models.BooleanField(default=False)
    attendance_recorded = models.BooleanField(default=False)
    attendees = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="attended_meetings"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(SoftDeleteModel.Meta):
        constraints = SoftDeleteModel.Meta.constraints + [
            models.CheckConstraint(
                condition=models.Q(summary_published=False)
                | (models.Q(summary_text__isnull=False) & ~models.Q(summary_text="")),
                name="meeting_published_summary_nonempty",
            ),
        ]

    def clean_fields(self, exclude=None):
        if not isinstance(self.starts_at, datetime) or timezone.is_naive(
            self.starts_at
        ):
            raise ValidationError({"starts_at": "La fecha debe incluir zona horaria."})
        if type(self.cancelled) is not bool:
            raise ValidationError({"cancelled": "El estado no es válido."})
        if self.summary_text is not None:
            if not isinstance(self.summary_text, str):
                raise ValidationError({"summary_text": "El resumen no es válido."})
            self.summary_text = self.summary_text.strip() or None
        super().clean_fields(exclude=exclude)

    def clean(self):
        super().clean()
        if self.summary_published and not self.summary_text:
            raise ValidationError(
                {"summary_text": "Un resumen publicado no puede estar vacío."}
            )


class ReadingAssignment(SoftDeleteModel):
    book = models.ForeignKey(
        "books.Book", on_delete=models.PROTECT, related_name="reading_assignments"
    )
    meeting = models.OneToOneField(
        Meeting,
        null=True,
        blank=True,
        default=None,
        on_delete=models.PROTECT,
        related_name="reading_assignment",
    )
    week_number = models.PositiveBigIntegerField()
    percent_start = models.FloatField()
    percent_end = models.FloatField()
    page_start = models.BigIntegerField()
    page_end = models.BigIntegerField()
    due_date = models.DateField(null=True, blank=True, default=None)
    notes = models.TextField(max_length=1000, null=True, blank=True, default=None)

    class Meta(SoftDeleteModel.Meta):
        constraints = SoftDeleteModel.Meta.constraints + [
            models.UniqueConstraint(
                fields=["book", "week_number"],
                condition=Q(deleted_at__isnull=True),
                name="reading_active_ordinal",
            ),
            models.CheckConstraint(
                condition=Q(week_number__gte=1, week_number__lte=MAX_SAFE_INTEGER),
                name="reading_ordinal_range",
            ),
            models.CheckConstraint(
                condition=Q(
                    page_start__gte=1,
                    page_start__lte=MAX_SAFE_INTEGER,
                    page_end__gte=1,
                    page_end__lte=MAX_SAFE_INTEGER,
                ),
                name="reading_page_range",
            ),
            models.CheckConstraint(
                condition=Q(
                    percent_start__gte=0,
                    percent_start__lte=1.7976931348623157e308,
                    percent_end__gte=0,
                    percent_end__lte=1.7976931348623157e308,
                ),
                name="reading_finite_percent",
            ),
        ]

    def clean(self):
        super().clean()
        from .reading_rules import clean_input

        try:
            clean = clean_input(
                {
                    "percentStart": self.percent_start,
                    "percentEnd": self.percent_end,
                    "pageStart": self.page_start,
                    "pageEnd": self.page_end,
                    "dueDate": self.due_date.isoformat() if self.due_date else None,
                    "notes": self.notes,
                    "meetingId": str(self.meeting_id) if self.meeting_id else None,
                }
            )
        except (ValueError, TypeError, OverflowError) as exc:
            raise ValidationError("Los datos de lectura no son válidos.") from exc
        self.notes = clean["notes"]
        if self.meeting_id and self.meeting.book_id != self.book_id:
            raise ValidationError("La reunión debe pertenecer al mismo libro.")


class ReadingCompletion(models.Model):
    assignment = models.ForeignKey(
        ReadingAssignment, on_delete=models.PROTECT, related_name="completions"
    )
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reading_completions",
    )
    completed_at = models.DateTimeField(null=True, blank=True, default=None)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "member"], name="reading_completion_unique_pair"
            )
        ]
