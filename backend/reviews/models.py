"""Admin-authored star anchors; null until the owner supplies descriptions."""

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Length
from django.db.models.lookups import LessThanOrEqual

from .constants import CRITERIA
from .math import overall_score, validated_scores


class RatingRubric(models.Model):
    criterion = models.CharField(max_length=10)
    star = models.PositiveSmallIntegerField()
    description = models.TextField(max_length=500, null=True, blank=True, default=None)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["criterion", "star"], name="rubric_anchor_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(criterion__in=CRITERIA),
                name="rubric_known_criterion",
            ),
            models.CheckConstraint(
                condition=models.Q(star__gte=1, star__lte=5), name="rubric_star_range"
            ),
            models.CheckConstraint(
                condition=models.Q(description__isnull=True)
                | LessThanOrEqual(Length("description"), 500),
                name="rubric_description_length",
            ),
        ]


class Review(models.Model):
    book = models.ForeignKey(
        "books.Book", on_delete=models.PROTECT, related_name="reviews"
    )
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reviews"
    )
    disfrute = models.DecimalField(max_digits=2, decimal_places=1)
    estilo = models.DecimalField(max_digits=2, decimal_places=1)
    personajes = models.DecimalField(max_digits=2, decimal_places=1)
    trama = models.DecimalField(max_digits=2, decimal_places=1)
    huella = models.DecimalField(max_digits=2, decimal_places=1)
    text = models.TextField(max_length=5000, null=True, blank=True, default=None)
    submitted_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True, default=None)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["book", "member"], name="review_unique_pair"
            ),
            *[
                models.CheckConstraint(
                    condition=models.Q(
                        **{f"{criterion}__in": [Decimal(n) / 2 for n in range(2, 11)]}
                    ),
                    name=f"review_{criterion}_half_stars",
                )
                for criterion in CRITERIA
            ],
            models.CheckConstraint(
                condition=models.Q(text__isnull=True)
                | LessThanOrEqual(Length("text"), 5000),
                name="review_text_length",
            ),
            models.CheckConstraint(
                condition=models.Q(edited_at__isnull=True)
                | models.Q(edited_at__gte=models.F("submitted_at")),
                name="review_edit_after_submission",
            ),
        ]

    @property
    def scores(self):
        return {criterion: getattr(self, criterion) for criterion in CRITERIA}

    @property
    def overall(self):
        return overall_score(self.scores)

    def clean_fields(self, exclude=None):
        try:
            validated_scores(self.scores)
        except ValueError as exc:
            raise ValidationError(
                "Las cinco puntuaciones deben ir de 1 a 5 en pasos de media estrella."
            ) from exc
        if self.text is not None:
            if not isinstance(self.text, str) or "\x00" in self.text:
                raise ValidationError("El texto no es válido.")
            try:
                self.text.encode("utf-8")
            except UnicodeError as exc:
                raise ValidationError("El texto no es válido.") from exc
            self.text = self.text.strip() or None
        super().clean_fields(exclude=exclude)
