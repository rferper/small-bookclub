import sqlite3
import zipfile

from django.core.management.base import BaseCommand, CommandError

from core.backups import restore_backup


class Command(BaseCommand):
    help = "Verifica y restaura una copia en una ubicación nueva, sin sustituir datos."

    def add_arguments(self, parser):
        parser.add_argument("--archive", required=True)
        parser.add_argument("--destination", required=True)

    def handle(self, *args, **options):
        try:
            restore_backup(options["archive"], options["destination"])
        except (
            OSError,
            ValueError,
            KeyError,
            sqlite3.Error,
            zipfile.BadZipFile,
        ) as error:
            raise CommandError(
                "No se ha podido verificar o restaurar la copia."
            ) from error
        self.stdout.write(
            self.style.SUCCESS("Copia restaurada en una ubicación nueva.")
        )
