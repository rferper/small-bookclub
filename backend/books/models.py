"""Manual catalogue facts, with database-enforced single active reading book."""

from datetime import date

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.models import SoftDeleteModel

MAX_SAFE_INTEGER = 9007199254740991


def catalogue_text(value, limit, *, required=False):
    if value is None and not required:
        return None
    if not isinstance(value, str) or "\x00" in value:
        raise ValidationError("El texto no es válido.")
    value = value.strip()
    if len(value) > limit or (required and not value):
        raise ValidationError("El texto no tiene una longitud válida.")
    return value if required else value or None


class Book(SoftDeleteModel):
    class Status(models.TextChoices):
        PROPOSED = "propuesto", "Propuesto"
        CHOSEN = "elegido", "Elegido"
        READING = "leyendo", "Leyendo"
        FINISHED = "terminado", "Terminado"
        ARCHIVED = "archivado", "Archivado"

    title = models.CharField(max_length=200)
    authors = models.JSONField(default=list, blank=True)
    description = models.TextField(max_length=5000, null=True, blank=True, default=None)
    cover_path = models.CharField(max_length=500, blank=True, default="")
    publication_date = models.CharField(
        max_length=100, null=True, blank=True, default=None
    )
    publisher = models.CharField(max_length=200, null=True, blank=True, default=None)
    isbn = models.CharField(max_length=100, null=True, blank=True, default=None)
    page_count = models.BigIntegerField(
        null=True,
        blank=True,
        default=None,
        validators=[MinValueValidator(1), MaxValueValidator(MAX_SAFE_INTEGER)],
    )
    external_ids = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=9, choices=Status, default=Status.PROPOSED)
    reading_start_date = models.DateField(null=True, blank=True, default=None)
    reading_end_date = models.DateField(null=True, blank=True, default=None)
    planned_start_date = models.DateField(null=True, blank=True, default=None)
    planned_end_date = models.DateField(null=True, blank=True, default=None)
    dates_approximate = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(SoftDeleteModel.Meta):
        constraints = SoftDeleteModel.Meta.constraints + [
            models.UniqueConstraint(
                fields=["status"],
                condition=models.Q(status="leyendo", deleted_at__isnull=True),
                name="book_one_active_reading",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    status__in=[
                        "propuesto",
                        "elegido",
                        "leyendo",
                        "terminado",
                        "archivado",
                    ]
                ),
                name="book_known_status",
            ),
            models.CheckConstraint(
                condition=models.Q(page_count__isnull=True)
                | models.Q(page_count__gte=1, page_count__lte=MAX_SAFE_INTEGER),
                name="book_page_count_range",
            ),
            models.CheckConstraint(
                condition=models.Q(reading_start_date__isnull=True)
                | models.Q(reading_end_date__isnull=True)
                | models.Q(reading_end_date__gte=models.F("reading_start_date")),
                name="book_actual_dates_order",
            ),
            models.CheckConstraint(
                condition=models.Q(planned_start_date__isnull=True)
                | models.Q(planned_end_date__isnull=True)
                | models.Q(planned_end_date__gte=models.F("planned_start_date")),
                name="book_planned_dates_order",
            ),
        ]

    def clean_fields(self, exclude=None):
        self.title = catalogue_text(self.title, 200, required=True)
        for field, limit in [
            ("description", 5000),
            ("publication_date", 100),
            ("publisher", 200),
            ("isbn", 100),
        ]:
            setattr(self, field, catalogue_text(getattr(self, field), limit))
        if not isinstance(self.authors, list) or len(self.authors) > 20:
            raise ValidationError({"authors": "La lista de autores no es válida."})
        self.authors = [
            catalogue_text(author, 120, required=True)
            for author in self.authors
            if not isinstance(author, str) or author.strip()
        ]
        if not isinstance(self.external_ids, dict) or len(self.external_ids) > 20:
            raise ValidationError(
                {"external_ids": "Los identificadores no son válidos."}
            )
        for key, value in self.external_ids.items():
            catalogue_text(key, 40, required=True)
            catalogue_text(value, 200, required=True)
        if self.page_count is not None and type(self.page_count) is not int:
            raise ValidationError({"page_count": "El número de páginas no es válido."})
        if type(self.dates_approximate) is not bool:
            raise ValidationError({"dates_approximate": "El indicador no es válido."})
        super().clean_fields(exclude=exclude)

    def clean(self):
        super().clean()
        for start, end in [
            (self.reading_start_date, self.reading_end_date),
            (self.planned_start_date, self.planned_end_date),
        ]:
            if isinstance(start, date) and isinstance(end, date) and end < start:
                raise ValidationError("La fecha final no puede preceder a la inicial.")
