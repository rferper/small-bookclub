"""Demo storage and startup boundaries use only disposable fictional resources."""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from books.models import Book
from core.models import DemoInstallation, LiteraryQuote
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]


def test_seed_is_explicit_and_disabled_by_default(settings):
    settings.DEMO_MODE = False
    with pytest.raises(CommandError, match="DEMO_MODE"):
        call_command("seed_demo")
    assert not User.objects.exists()
    assert not DemoInstallation.objects.exists()


@pytest.mark.parametrize("existing", ["member", "book", "quote", "removed_book"])
def test_seed_refuses_unmarked_populated_databases(settings, existing):
    settings.DEMO_MODE = True
    if existing == "member":
        User.objects.create_user("100000000000000001", display_name="Fictional member")
    elif existing == "quote":
        LiteraryQuote.objects.create(text="A fictional custom quote", active=True)
    else:
        book = Book.objects.create(title="Fictional retained book")
        if existing == "removed_book":
            actor = User.objects.create_user(
                "100000000000000001",
                display_name="Fictional admin",
                approved=True,
                role="admin",
            )
            book.soft_delete(actor)
    with pytest.raises(CommandError, match="sin marca de demo"):
        call_command("seed_demo")
    assert not DemoInstallation.objects.exists()
    assert not User.objects.filter(discord_user_id="990000000000000001").exists()


def test_failed_seed_rolls_back_all_fixtures_and_marker(settings, monkeypatch):
    from votes.models import VoteCandidate

    settings.DEMO_MODE = True

    def fail(*args, **kwargs):
        raise RuntimeError("fictional seed storage failure")

    monkeypatch.setattr(VoteCandidate.objects, "create", fail)
    with pytest.raises(RuntimeError, match="fictional seed storage failure"):
        call_command("seed_demo")
    assert not User.objects.exists()
    assert not Book.all_objects.exists()
    assert not DemoInstallation.objects.exists()


@pytest.mark.parametrize("enabled", [False, True])
def test_real_startup_modes_and_demo_http_security(tmp_path, enabled):
    backend = Path(__file__).resolve().parents[2]
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings",
        "BOOKCLUB_ENV": "test",
        "DEMO_MODE": str(enabled).lower(),
        "DATABASE_PATH": str(tmp_path / "fictional-demo.sqlite3"),
        "MEDIA_ROOT": str(tmp_path / "media"),
        "PYTHONPATH": str(backend),
        "PYTHONIOENCODING": "utf-8",
    }
    result = subprocess.run(
        [sys.executable, "tests/integration/demo_probe.py"],
        cwd=backend,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr
