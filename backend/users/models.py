from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.hashers import is_password_usable, make_password
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator
from django.db import models
from django.utils import timezone

from .managers import UserManager
from .validators import (
    DISCORD_ID_PATTERN,
    normalize_profile,
    validate_discord_id,
    validate_display_name,
    validate_membership,
)


def unusable_password():
    return make_password(None)


class User(AbstractBaseUser):
    class Role(models.TextChoices):
        MEMBER = "member", "Miembro"
        ADMIN = "admin", "Administrador"

    discord_user_id = models.CharField(
        max_length=20, unique=True, validators=[validate_discord_id]
    )
    role = models.CharField(max_length=6, choices=Role, default=Role.MEMBER)
    approved = models.BooleanField(default=False)
    revoked_at = models.DateTimeField(null=True, blank=True)
    display_name = models.CharField(max_length=40, validators=[validate_display_name])
    bio = models.TextField(
        max_length=500,
        null=True,
        blank=True,
        default=None,
        validators=[MaxLengthValidator(500)],
    )
    favourite_quote = models.TextField(
        max_length=300,
        null=True,
        blank=True,
        default=None,
        validators=[MaxLengthValidator(300)],
    )
    avatar_path = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    password = models.CharField(max_length=128, default=unusable_password)

    objects = UserManager()

    USERNAME_FIELD = "discord_user_id"
    REQUIRED_FIELDS = ["display_name"]

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(discord_user_id__regex=DISCORD_ID_PATTERN),
                name="user_discord_id_ascii_digits",
            ),
            models.CheckConstraint(
                condition=models.Q(role__in=["member", "admin"]),
                name="user_role_member_or_admin",
            ),
            models.CheckConstraint(
                condition=models.Q(approved=False) | models.Q(revoked_at__isnull=True),
                name="user_approved_not_revoked",
            ),
        ]

    @property
    def is_active(self):
        return self.approved is True and self.revoked_at is None

    def set_password(self, raw_password):
        if raw_password is not None:
            raise ValueError(
                "Local passwords are disabled; use Discord authentication."
            )
        super().set_password(None)

    async def aset_password(self, raw_password):
        self.set_password(raw_password)

    def _normalize_profile(self):
        normalize_profile(self)

    def clean_fields(self, exclude=None):
        self._normalize_profile()
        super().clean_fields(exclude=exclude)

    def clean(self):
        super().clean()
        self._normalize_profile()
        validate_membership(self)
        if is_password_usable(self.password):
            raise ValidationError(
                {"password": "Las contraseñas locales están desactivadas."}
            )


class CuratorAssignment(models.Model):
    """A retained cycle identity, never an account role."""

    member = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="curator_assignments"
    )
    assigned_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True, default=None)
    current = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["current"],
                condition=models.Q(current=True),
                name="curator_one_current",
            ),
            models.CheckConstraint(
                condition=models.Q(current=True, ended_at__isnull=True)
                | models.Q(current=False, ended_at__isnull=False),
                name="curator_current_end_consistent",
            ),
            models.CheckConstraint(
                condition=models.Q(ended_at__isnull=True)
                | models.Q(ended_at__gte=models.F("assigned_at")),
                name="curator_date_order",
            ),
        ]
