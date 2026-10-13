"""Admin-authored star anchors; null until the owner supplies descriptions."""

from django.db import models
from django.db.models.functions import Length
from django.db.models.lookups import LessThanOrEqual

CRITERIA = ("disfrute", "estilo", "personajes", "trama", "huella")


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
