import io
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest
from allauth.socialaccount.models import SocialAccount, SocialToken
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError
from django.utils import timezone

from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
IDENTITY = "100000000000000001"


def run(monkeypatch, identity=IDENTITY):
    if identity is None:
        monkeypatch.delenv("INITIAL_ADMIN_DISCORD_ID", raising=False)
    else:
        monkeypatch.setenv("INITIAL_ADMIN_DISCORD_ID", identity)
    output = io.StringIO()
    call_command("bootstrap_admin", stdout=output)
    assert IDENTITY not in output.getvalue()
    return output.getvalue()


def rows():
    return list(User.objects.order_by("pk").values())


def test_create_native_owner_and_exact_unchanged_rerun(monkeypatch):
    assert "creado" in run(monkeypatch)
    user = User.objects.get()
    assert user.discord_user_id == IDENTITY
    assert user.role == "admin" and user.approved and user.revoked_at is None
    assert user.display_name == "Administrador" and user.avatar_path == ""
    assert user.bio is user.favourite_quote is user.last_login is None
    assert not user.has_usable_password()
    assert not hasattr(user, "is_staff") and not hasattr(user, "is_superuser")
    assert not SocialAccount.objects.exists() and not SocialToken.objects.exists()
    before = rows()
    assert "ya configurado" in run(monkeypatch)
    assert rows() == before


@pytest.mark.parametrize("role", ["member", "admin"])
@pytest.mark.parametrize("status", ["pending", "approved", "revoked"])
def test_reuse_all_target_states_preserving_native_identity(monkeypatch, role, status):
    user = User.objects.create_user(
        IDENTITY,
        role=role,
        approved=status == "approved",
        revoked_at=timezone.now() if status == "revoked" else None,
        display_name="Luna nativa",
        bio="Native bio",
        favourite_quote="Native quote",
        avatar_path="/media/fictional.webp",
        last_login=timezone.now(),
    )
    User.objects.create_user("200000000000000002", display_name="Sol")
    before = rows()
    output = run(monkeypatch)
    user.refresh_from_db()
    assert user.role == "admin" and user.approved and user.revoked_at is None
    after = rows()
    changed = {"role", "approved", "revoked_at", "updated_at"}
    assert {k: v for k, v in before[0].items() if k not in changed} == {
        k: v for k, v in after[0].items() if k not in changed
    }
    assert before[1] == after[1]
    assert (
        "ya configurado"
        if role == "admin" and status == "approved"
        else "promovido o reaprobado"
    ) in output
    assert "ya configurado" in run(monkeypatch)
    assert rows() == after


@pytest.mark.parametrize(
    "identity",
    [
        None,
        "",
        " ",
        "\t\n",
        " " + IDENTITY,
        IDENTITY + " ",
        "+" + IDENTITY,
        "-" + IDENTITY,
        "x" * 17,
        "1" * 16,
        "1" * 21,
        "١" * 17,
        "１" * 17,
        IDENTITY + "\n",
    ],
)
def test_invalid_environment_no_writes(monkeypatch, identity):
    User.objects.create_user(IDENTITY, display_name="Luna")
    before = rows()
    with pytest.raises(CommandError, match="dígitos ASCII"):
        run(monkeypatch, identity)
    assert rows() == before


@pytest.mark.parametrize("status", ["pending", "approved", "revoked"])
@pytest.mark.parametrize("target", ["absent", "pending", "approved", "revoked"])
def test_different_admin_blocks_every_target_without_changes(
    monkeypatch, status, target
):
    other = "200000000000000002"
    User.objects.create_user(
        other,
        display_name="Sol",
        role="admin",
        approved=status == "approved",
        revoked_at=timezone.now() if status == "revoked" else None,
    )
    if target != "absent":
        User.objects.create_user(
            IDENTITY,
            display_name="Luna",
            approved=target == "approved",
            revoked_at=timezone.now() if target == "revoked" else None,
        )
    before = rows()
    with pytest.raises(CommandError, match="otro administrador") as error:
        run(monkeypatch)
    assert other not in str(error.value) and IDENTITY not in str(error.value)
    assert rows() == before


@pytest.mark.parametrize(
    "fields",
    [
        {"display_name": ""},
        {"display_name": " Luna "},
        {"bio": " padded "},
        {"bio": "x" * 501},
        {"favourite_quote": "x" * 301},
        {"password": "plaintext-secret"},
        {"avatar_path": "x" * 501},
    ],
)
def test_malformed_persisted_target_fails_without_repair(monkeypatch, fields):
    user = User.objects.create_user(IDENTITY, display_name="Luna")
    User.objects.filter(pk=user.pk).update(**fields)
    before = rows()
    with pytest.raises(CommandError, match="no se guardaron cambios") as error:
        run(monkeypatch)
    assert "plaintext-secret" not in str(error.value)
    assert rows() == before


@pytest.mark.parametrize("existing", [False, True])
def test_persistence_failure_rolls_back_even_after_write(monkeypatch, existing):
    if existing:
        User.objects.create_user(IDENTITY, display_name="Luna")
    before = rows()
    save = User.save

    def fail_after_save(self, *args, **kwargs):
        save(self, *args, **kwargs)
        raise IntegrityError("private-storage-sentinel")

    monkeypatch.setattr(User, "save", fail_after_save)
    with pytest.raises(CommandError, match="no se guardaron cambios") as error:
        run(monkeypatch)
    assert "private-storage-sentinel" not in str(error.value)
    assert rows() == before


def test_environment_subprocess_exit_output_and_no_startup_provisioning(tmp_path):
    database = tmp_path / "bootstrap.sqlite3"
    environ = dict(
        os.environ,
        BOOKCLUB_ENV="test",
        DATABASE_PATH=str(database),
        INITIAL_ADMIN_DISCORD_ID=IDENTITY,
        PYTHONIOENCODING="utf-8",
    )

    def execute(*args):
        return subprocess.run(
            [sys.executable, "manage.py", *args],
            cwd=Path(__file__).parents[2],
            env=environ,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )

    assert execute("migrate", "--noinput").returncode == 0
    assert execute("check").returncode == 0
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT count(*) FROM users_user").fetchone() == (0,)
    for expected in ["creado", "ya configurado"]:
        result = execute("bootstrap_admin")
        assert result.returncode == 0 and expected in result.stdout
        assert IDENTITY not in result.stdout + result.stderr
    with sqlite3.connect(database) as connection:
        before = connection.execute("SELECT * FROM users_user").fetchall()
        connection.execute(
            "UPDATE users_user SET approved=0, revoked_at='2026-01-01 00:00:00+00:00'"
        )
        revoked = connection.execute("SELECT * FROM users_user").fetchall()
    assert execute("check").returncode == 0
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT * FROM users_user").fetchall() == revoked
    for invalid in [None, IDENTITY + "\n", "2" * 17]:
        if invalid is None:
            environ.pop("INITIAL_ADMIN_DISCORD_ID", None)
        else:
            environ["INITIAL_ADMIN_DISCORD_ID"] = invalid
        result = execute("bootstrap_admin")
        assert result.returncode != 0 and "CommandError" in result.stderr
        assert IDENTITY not in result.stdout + result.stderr
        with sqlite3.connect(database) as connection:
            assert connection.execute("SELECT * FROM users_user").fetchall() == revoked
    environ["INITIAL_ADMIN_DISCORD_ID"] = IDENTITY
    assert "reaprobado" in execute("bootstrap_admin").stdout
    assert len(before) == 1
    for override in [IDENTITY, "--discord-id=" + IDENTITY]:
        assert execute("bootstrap_admin", override).returncode != 0
