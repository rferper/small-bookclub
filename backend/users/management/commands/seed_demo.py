from django.core.management.base import BaseCommand

from users.demo import seed_demo


class Command(BaseCommand):
    help = "Crea una demo ficticia habilitada explícitamente; conserva las ediciones."

    def handle(self, *args, **options):
        created = seed_demo()
        self.stdout.write(
            "Demo ficticia creada." if created else "La demo ya existe; se conserva."
        )
