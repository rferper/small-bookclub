from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.hashers import make_password

from .validators import normalize_profile, validate_membership


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, discord_user_id=None, password=None, **extra_fields):
        if password is not None:
            raise ValueError(
                "Local passwords are disabled; use Discord authentication."
            )
        user = self.model(discord_user_id=discord_user_id, **extra_fields)
        # Historical migration models do not inherit custom instance methods.
        user.password = make_password(None)
        normalize_profile(user)
        validate_membership(user)
        user.full_clean()
        user.save(using=self._db)
        return user

    def create_superuser(self, *args, **kwargs):
        raise ValueError(
            "Local superuser creation is disabled; provisioning belongs to #6."
        )
