import sqlite3
import zipfile

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.backups import create_backup


class Command(BaseCommand):
    help = "Crea una copia consistente de SQLite y los archivos privados."

    def add_arguments(self, parser):
        parser.add_argument("--destination", required=True)
        parser.add_argument("--keep", type=int, required=True)

    def handle(self, *args, **options):
        database = settings.DATABASES["default"]
        if (
            database["ENGINE"] != "django.db.backends.sqlite3"
            or database["NAME"] == ":memory:"
        ):
            raise CommandError("Se requiere una base de datos SQLite persistente.")
        try:
            output = create_backup(
                database["NAME"],
                settings.MEDIA_ROOT,
                options["destination"],
                options["keep"],
                {
                    "TIME_ZONE": settings.TIME_ZONE,
                    "LANGUAGE_CODE": settings.LANGUAGE_CODE,
                },
            )
        except (OSError, ValueError, sqlite3.Error, zipfile.BadZipFile) as error:
            raise CommandError(
                "No se ha podido completar la copia o su rotación."
            ) from error
        self.stdout.write(self.style.SUCCESS(f"Copia creada: {output.name}"))
