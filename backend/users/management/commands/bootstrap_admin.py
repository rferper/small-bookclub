"""Explicit, finite native-owner bootstrap; never called by startup or HTTP."""

import os

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError, transaction

from users.models import User
from users.validators import validate_discord_id


class Command(BaseCommand):
    help = "Configura explícitamente el administrador inicial desde el entorno."

    def handle(self, *args, **options):
        identity = os.environ.get("INITIAL_ADMIN_DISCORD_ID")
        try:
            validate_discord_id(identity)
        except ValidationError:
            raise CommandError(
                "INITIAL_ADMIN_DISCORD_ID debe contener de 17 a 20 dígitos ASCII "
                "exactos, sin espacios."
            ) from None

        try:
            with transaction.atomic():
                users = User.objects.select_for_update()
                if (
                    users.filter(role=User.Role.ADMIN)
                    .exclude(discord_user_id=identity)
                    .exists()
                ):
                    raise CommandError(
                        "Ya existe otro administrador; no se cambia la propiedad."
                    )
                user = users.filter(discord_user_id=identity).first()
                if user is None:
                    User.objects.create_user(
                        identity,
                        display_name="Administrador",
                        role=User.Role.ADMIN,
                        approved=True,
                    )
                    outcome = "Administrador inicial creado."
                else:
                    # Validate the stored row before changing membership. Reject
                    # normalization rather than silently repairing native profiles.
                    stored = {
                        field.attname: getattr(user, field.attname)
                        for field in user._meta.concrete_fields
                    }
                    user.full_clean()
                    if any(
                        getattr(user, field) != value for field, value in stored.items()
                    ):
                        raise ValidationError("Perfil almacenado sin normalizar.")
                    if user.role == User.Role.ADMIN and user.is_active:
                        outcome = "Administrador inicial ya configurado."
                    else:
                        user.role = User.Role.ADMIN
                        user.approved = True
                        user.revoked_at = None
                        user.full_clean()
                        user.save(
                            update_fields=[
                                "role",
                                "approved",
                                "revoked_at",
                                "updated_at",
                            ]
                        )
                        outcome = "Administrador inicial promovido o reaprobado."
        except (ValidationError, DatabaseError):
            raise CommandError(
                "No se pudo configurar el administrador; no se guardaron cambios."
            ) from None
        self.stdout.write(self.style.SUCCESS(outcome))
