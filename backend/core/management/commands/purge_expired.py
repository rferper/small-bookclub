"""Finite operator-triggered purge; no startup hook or production seed identity."""

from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError, IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.utils import timezone

from core.models import CoverErasure
from core.recycle import MODELS, erase_cover, purge_blocked, purge_target
from users.access import permission_refusal
from users.membership import native_member_id
from users.models import User


def current_actor(actor_id):
    actor = User.objects.select_for_update().filter(pk=actor_id).first()
    if permission_refusal(actor, "restore_content") is not None:
        raise CommandError("Se requiere un administrador aprobado y no revocado.")
    return actor


class Command(BaseCommand):
    help = "Purga el contenido eliminado cuyo plazo de 30 días ha vencido."

    def add_arguments(self, parser):
        parser.add_argument("--actor-id", required=True)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        actor_id = native_member_id(options["actor_id"])
        if actor_id is None:
            raise CommandError("--actor-id debe ser el ID nativo de un administrador.")
        cutoff = timezone.now()
        dry_run = options["dry_run"]
        eligible = blocked = retried = 0
        try:
            with transaction.atomic():
                current_actor(actor_id)
            # Descendants first; never cascade into active or protected history.
            for kind in ("highlight", "quote", "week", "meeting", "book"):
                model = MODELS[kind]
                candidates = list(
                    model.all_objects.filter(
                        deleted_at__isnull=False, purge_due_at__lte=cutoff
                    ).values_list("pk", flat=True)
                )
                for resource_id in candidates:
                    with transaction.atomic():
                        actor = current_actor(actor_id)
                        row = (
                            model.all_objects.select_for_update()
                            .filter(
                                pk=resource_id,
                                deleted_at__isnull=False,
                                purge_due_at__lte=cutoff,
                            )
                            .first()
                        )
                        if row is None:
                            continue
                        try:
                            if dry_run:
                                removed = not purge_blocked(kind, row)
                            else:
                                removed = purge_target(kind, row, actor)
                        except (ProtectedError, IntegrityError):
                            removed = False
                        if removed:
                            eligible += 1
                        else:
                            blocked += 1
            if not dry_run:
                for key in list(CoverErasure.objects.values_list("key", flat=True)):
                    with transaction.atomic():
                        current_actor(actor_id)
                        transaction.on_commit(
                            lambda key=key: erase_cover(key), robust=True
                        )
                        retried += 1
            pending = CoverErasure.objects.count()
        except DatabaseError:
            raise CommandError(
                "No se pudo completar la purga. Revise la base de datos y reintente."
            ) from None
        label = "Simulación: elegibles" if dry_run else "Purgados"
        self.stdout.write(
            f"{label}: {eligible}; bloqueados por historial: {blocked}; "
            f"portadas pendientes: {pending}; "
            f"reintentos programados: {retried}."
        )
