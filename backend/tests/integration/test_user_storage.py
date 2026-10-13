import os
import sqlite3
import subprocess
import sys
from datetime import datetime, timedelta
from datetime import timezone as datetime_timezone
from pathlib import Path

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone

from users.models import User

pytestmark = pytest.mark.integration


@pytest.fixture
def user(db):
    return User.objects.create_user("12345678901234567", display_name="Luna")


def test_manager_defaults_native_profile_roundtrip_and_exact_identity(db):
    user = User.objects.create_user(
        "98765432109876543210",
        display_name="  Luna de Papel  ",
        bio="  Fictional reader.\nSecond line.  ",
        favourite_quote="  <fictional>Words</fictional>  ",
    )
    user.refresh_from_db()
    assert isinstance(user.pk, int)
    assert str(user.pk) != user.discord_user_id
    assert user.discord_user_id == "98765432109876543210"
    assert user.display_name == "Luna de Papel"
    assert user.bio == "Fictional reader.\nSecond line."
    assert user.favourite_quote == "<fictional>Words</fictional>"
    assert user.avatar_path == ""
    assert user.role == "member"
    assert not user.approved and user.revoked_at is None and not user.is_active
    assert not user.has_usable_password()
    assert user.last_login is None
    assert timezone.is_aware(user.created_at) and timezone.is_aware(user.updated_at)
    assert User.objects.get_by_natural_key(user.discord_user_id).pk == user.pk


@pytest.mark.parametrize(
    "fields",
    [
        {"discord_user_id": None},
        {"discord_user_id": ""},
        {"discord_user_id": " "},
        {"discord_user_id": "1" * 16},
        {"discord_user_id": "1" * 21},
        {"discord_user_id": "١" * 17},
        {"discord_user_id": "1" * 17 + "\n"},
        {"discord_user_id": 12345678901234567},
        {"discord_user_id": "1" * 16 + "x"},
        {"display_name": " \n "},
        {"display_name": None},
        {"display_name": "Luna\u2028Mar"},
        {"display_name": "x" * 41},
        {"bio": "x" * 501},
        {"favourite_quote": "x" * 301},
        {"role": "curator"},
        {
            "approved": True,
            "revoked_at": datetime(2026, 1, 1, tzinfo=datetime_timezone.utc),
        },
        {"revoked_at": datetime(2026, 1, 1)},
    ],
)
def test_supported_creation_rejects_invalid_values_without_persisting(db, fields):
    values = {"discord_user_id": "1" * 17, "display_name": "Luna"} | fields
    with pytest.raises(ValidationError):
        User.objects.create_user(**values)
    assert not User.objects.exists()


def test_supported_creation_requires_name_and_identity(db):
    with pytest.raises(ValidationError):
        User.objects.create_user(display_name="Luna")
    with pytest.raises(ValidationError):
        User.objects.create_user("1" * 17)
    assert not User.objects.exists()


@pytest.mark.parametrize("password", ["fictional-password", "", "!already-unusable"])
def test_supported_creation_rejects_every_supplied_password(db, password):
    with pytest.raises(ValueError, match="password"):
        User.objects.create_user("1" * 17, password=password, display_name="Luna")
    assert not User.objects.exists()


@pytest.mark.parametrize("role", ["member", "admin"])
@pytest.mark.parametrize("state", ["pending", "approved", "revoked"])
def test_persisted_membership_states_and_role_do_not_imply_approval(db, role, state):
    user = User.objects.create_user(
        "1" * 17,
        display_name="Luna",
        role=role,
        approved=state == "approved",
        revoked_at=timezone.now() if state == "revoked" else None,
    )
    user.refresh_from_db()
    assert user.is_active is (state == "approved")
    assert user.role == role
    assert not user.has_usable_password()
    if state == "revoked":
        assert timezone.is_aware(user.revoked_at)


@pytest.mark.parametrize("value", [None, "", "  \n  "])
def test_optional_profile_empty_values_persist_as_null(db, value):
    user = User.objects.create_user(
        "1" * 17, display_name="Luna", bio=value, favourite_quote=value
    )
    user.refresh_from_db()
    assert user.bio is user.favourite_quote is None
    assert user.avatar_path == ""


@pytest.mark.parametrize(
    "fields",
    [
        {"discord_user_id": None},
        {"discord_user_id": ""},
        {"discord_user_id": " "},
        {"discord_user_id": "1" * 16},
        {"discord_user_id": "1" * 21},
        {"discord_user_id": "١" * 17},
        {"discord_user_id": "１" * 17},
        {"discord_user_id": "1" * 17 + "\n"},
        {"discord_user_id": "1" * 16 + "x"},
        {"role": "curator"},
        {"role": "owner"},
        {"role": ""},
        {"role": None},
        {
            "approved": True,
            "revoked_at": datetime(2026, 1, 1, tzinfo=datetime_timezone.utc),
        },
    ],
)
def test_sql_checks_reject_validation_bypass(user, fields):
    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.filter(pk=user.pk).update(**fields)
    user.refresh_from_db()
    assert user.discord_user_id == "12345678901234567"
    assert user.role == "member"
    assert not user.approved and user.revoked_at is None


def test_duplicate_identity_cannot_reuse_revoked_user(user):
    User.objects.filter(pk=user.pk).update(revoked_at=timezone.now())
    with pytest.raises(ValidationError):
        User.objects.create_user(user.discord_user_id, display_name="Mar")
    # bulk_create deliberately bypasses manager validation and model hooks.
    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.bulk_create(
            [User(discord_user_id=user.discord_user_id, display_name="Mar")]
        )
    assert User.objects.count() == 1


def test_profile_update_preserves_identity_creation_and_login(user, monkeypatch):
    identity, created, updated = user.pk, user.created_at, user.updated_at
    later = updated + timedelta(seconds=1)
    monkeypatch.setattr(timezone, "now", lambda: later)
    user.display_name = "Mar de Papel"
    user.bio = "Fictional updated profile"
    user.avatar_path = "avatars/fictional.webp"
    user.last_login = later
    user.full_clean()
    user.save()
    user.refresh_from_db()
    assert user.pk == identity and user.discord_user_id == "12345678901234567"
    assert user.created_at == created and user.updated_at == later > updated
    assert user.last_login == later
    assert user.display_name == "Mar de Papel"
    assert user.bio == "Fictional updated profile"
    assert user.avatar_path == "avatars/fictional.webp"


def test_user_migrations_install_custom_identity_and_curator_and_are_repeatable(
    tmp_path,
):
    backend = Path(__file__).resolve().parents[2]
    database = tmp_path / "issue-2-empty.sqlite3"
    environment = os.environ | {"BOOKCLUB_ENV": "test", "DATABASE_PATH": str(database)}

    def manage(*args):
        result = subprocess.run(
            [sys.executable, "manage.py", *args],
            cwd=backend,
            env=environment,
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stderr
        return result.stdout

    assert "users.0001_initial" in manage("migrate", "--noinput")
    assert "No migrations to apply" in manage("migrate", "--noinput")
    assert "No changes detected" in manage("makemigrations", "--check", "--dry-run")
    with sqlite3.connect(database) as database_connection:
        tables = {
            row[0]
            for row in database_connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        assert "users_user" in tables and "auth_user" not in tables
        assert "django_session" in tables
        sql = database_connection.execute(
            "SELECT sql FROM sqlite_master WHERE name='users_user'"
        ).fetchone()[0]
        for constraint in [
            "user_discord_id_ascii_digits",
            "user_role_member_or_admin",
            "user_approved_not_revoked",
            "UNIQUE",
        ]:
            assert constraint in sql
        migrations = database_connection.execute(
            "SELECT app, name FROM django_migrations WHERE app='users' ORDER BY name"
        ).fetchall()
        assert migrations == [
            ("users", "0001_initial"),
            ("users", "0002_curatorassignment"),
        ]
        assert "users_curatorassignment" in tables


def test_database_has_no_independent_active_column(user):
    with connection.cursor() as cursor:
        columns = connection.introspection.get_table_description(
            cursor, User._meta.db_table
        )
    assert "is_active" not in {column.name for column in columns}


def test_serialized_manager_can_create_with_historical_migration_model(db):
    historical = (
        MigrationExecutor(connection)
        .loader.project_state([("users", "0001_initial")])
        .apps.get_model("users", "User")
    )
    user = historical.objects.create_user("9" * 20, display_name="  Luna  ")
    actual = User.objects.get(pk=user.pk)
    assert actual.display_name == "Luna"
    assert actual.discord_user_id == "9" * 20
    assert not actual.has_usable_password() and not actual.is_active
