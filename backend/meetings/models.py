"""Retained calendar records; substantive meeting content stays private."""

from datetime import datetime

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from core.models import SoftDeleteModel


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
