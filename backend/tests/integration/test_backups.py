import io
import json
import os
import sqlite3
import stat
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from core import backups

pytestmark = pytest.mark.integration
KEY = "a" * 32


@pytest.fixture
def storage(tmp_path):
    database = tmp_path / "fictional.sqlite3"
    media = tmp_path / "private_media"
    (media / "avatars").mkdir(parents=True)
    (media / "covers").mkdir()
    with sqlite3.connect(database) as connection:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute(
            "CREATE TABLE users_user (display_name TEXT, avatar_path TEXT)"
        )
        connection.execute("CREATE TABLE books_book (title TEXT, cover_path TEXT)")
        connection.execute("CREATE TABLE retained_reviews (text TEXT)")
        connection.execute(
            "INSERT INTO users_user VALUES (?, ?)",
            ("Fictional member", f"/api/media/avatars/{KEY}"),
        )
        connection.execute(
            "INSERT INTO books_book VALUES (?, ?)",
            ("Fictional book", f"/api/media/covers/{KEY}"),
        )
        connection.execute(
            "INSERT INTO retained_reviews VALUES ('Fictional private review')"
        )
    (media / "avatars" / f"{KEY}.webp").write_bytes(b"fictional avatar bytes")
    (media / "covers" / f"{KEY}.webp").write_bytes(b"fictional cover bytes")
    return database, media, tmp_path / "archives"


def archive(storage, keep=3):
    return backups.create_backup(*storage, keep, {"TIME_ZONE": "Europe/Madrid"})


def test_online_snapshot_restores_committed_wal_records_media_and_runtime(
    storage, tmp_path
):
    database, media, _ = storage
    # Keep a connection open so a committed write remains in the WAL.
    with sqlite3.connect(database) as connection:
        connection.execute(
            "INSERT INTO retained_reviews VALUES ('Fictional WAL review')"
        )
        connection.commit()
        assert database.with_name(database.name + "-wal").exists()
        result = backups.restore_backup(archive(storage), tmp_path / "restored")
    with sqlite3.connect(result / "database.sqlite3") as restored:
        assert restored.execute("SELECT * FROM retained_reviews").fetchall() == [
            ("Fictional private review",),
            ("Fictional WAL review",),
        ]
        assert restored.execute("SELECT display_name FROM users_user").fetchone() == (
            "Fictional member",
        )
    for area in ["avatars", "covers"]:
        assert (result / "media" / area / f"{KEY}.webp").read_bytes() == (
            media / area / f"{KEY}.webp"
        ).read_bytes()
    assert json.loads((result / "runtime.json").read_text()) == {
        "TIME_ZONE": "Europe/Madrid"
    }


def test_backup_excludes_database_writes_until_media_is_captured_and_then_releases_lock(
    storage, monkeypatch
):
    original = backups.media_files
    attempts = []

    def while_locked(root, snapshot):
        with sqlite3.connect(storage[0], timeout=0) as writer:
            assert writer.execute("SELECT COUNT(*) FROM users_user").fetchone() == (1,)
            with pytest.raises(sqlite3.OperationalError, match="locked"):
                writer.execute(
                    "INSERT INTO retained_reviews VALUES ('Blocked fictional change')"
                )
            attempts.append(True)
        return original(root, snapshot)

    monkeypatch.setattr(backups, "media_files", while_locked)
    archive(storage)
    assert attempts == [True]
    with sqlite3.connect(storage[0], timeout=0) as writer:
        writer.execute("INSERT INTO retained_reviews VALUES ('Later fictional change')")


def test_rotation_is_bounded_and_preserves_unrelated_and_unrecognized_files(storage):
    destination = storage[2]
    destination.mkdir()
    unrelated = destination / "other.zip"
    unrelated.write_bytes(b"unrelated bytes")
    unrecognized = destination / (
        "bookclub-backup-20200101T000000000000Z-" + "b" * 32 + ".zip"
    )
    unrecognized.write_bytes(b"not a managed backup")
    first, second, third = [archive(storage, keep=2) for _ in range(3)]
    assert not first.exists() and second.exists() and third.exists()
    assert unrelated.read_bytes() == b"unrelated bytes"
    assert unrecognized.read_bytes() == b"not a managed backup"


@pytest.mark.parametrize("keep", [0, -1, 31, True, "3"])
def test_refuses_unbounded_or_invalid_rotation(storage, keep):
    with pytest.raises(ValueError):
        archive(storage, keep)
    assert not storage[2].exists()


def test_missing_media_does_not_publish_partial_archive_or_rotate_good_backup(storage):
    existing = archive(storage, keep=1)
    (storage[1] / "avatars" / f"{KEY}.webp").unlink()
    with pytest.raises(ValueError, match="Missing"):
        archive(storage, keep=1)
    assert list(storage[2].iterdir()) == [existing]
    with sqlite3.connect(storage[0], timeout=0) as writer:
        writer.execute(
            "INSERT INTO retained_reviews VALUES ('Lock released after failure')"
        )


def test_rejects_unknown_media_and_destination_inside_media(storage):
    with pytest.raises(ValueError):
        backups.create_backup(storage[0], storage[1], storage[1] / "backups", 3, {})
    (storage[1] / "unexpected.txt").write_text("fictional unexpected file")
    with pytest.raises(ValueError, match="Unexpected"):
        archive(storage)
    assert not list(storage[2].iterdir())


def rewrite(source, target, change):
    with zipfile.ZipFile(source) as original:
        entries = {name: original.read(name) for name in original.namelist()}
    change(entries)
    with zipfile.ZipFile(target, "w") as modified:
        for name, content in entries.items():
            modified.writestr(name, content)
    return target


@pytest.mark.parametrize(
    "bad_name", ["../escape", "/absolute", "media/avatars/../escape", "unexpected.txt"]
)
def test_restore_refuses_extra_or_unsafe_members_before_creating_output(
    storage, tmp_path, bad_name
):
    source = archive(storage)
    malicious = rewrite(
        source,
        tmp_path / "bad.zip",
        lambda entries: entries.update({bad_name: b"fictional"}),
    )
    destination = tmp_path / "restore"
    with pytest.raises(ValueError):
        backups.restore_backup(malicious, destination)
    assert not destination.exists()


def test_restore_hash_failure_cleans_only_new_output_and_preserves_existing_destination(
    storage, tmp_path
):
    source = archive(storage)
    bad = rewrite(
        source,
        tmp_path / "bad.zip",
        lambda entries: entries.update(
            {"runtime.json": b" " * len(entries["runtime.json"])}
        ),
    )
    destination = tmp_path / "restore"
    with pytest.raises(ValueError, match="integrity"):
        backups.restore_backup(bad, destination)
    assert not destination.exists()
    destination.mkdir()
    marker = destination / "owner.txt"
    marker.write_text("fictional existing data")
    with pytest.raises(ValueError, match="new"):
        backups.restore_backup(source, destination)
    assert marker.read_text() == "fictional existing data"


def test_restore_refuses_duplicate_entries(storage, tmp_path):
    source = archive(storage)
    bad = tmp_path / "duplicate.zip"
    with zipfile.ZipFile(source) as original, zipfile.ZipFile(bad, "w") as target:
        for name in original.namelist():
            target.writestr(name, original.read(name))
        with pytest.warns(UserWarning):
            target.writestr("runtime.json", b"{}")
    with pytest.raises(ValueError, match="Duplicate"):
        backups.restore_backup(bad, tmp_path / "restore")


def test_restore_refuses_archive_symlink_metadata(storage, tmp_path):
    source = archive(storage)
    bad = tmp_path / "symlink.zip"
    with zipfile.ZipFile(source) as original, zipfile.ZipFile(bad, "w") as target:
        for name in original.namelist():
            info = zipfile.ZipInfo(name)
            if name == "runtime.json":
                info.external_attr = (stat.S_IFLNK | 0o777) << 16
            target.writestr(info, original.read(name))
    with pytest.raises(ValueError, match="Non-regular"):
        backups.restore_backup(bad, tmp_path / "restore")


def test_refuses_symlinked_media_when_platform_allows_it(storage, tmp_path):
    file = storage[1] / "avatars" / f"{KEY}.webp"
    outside = tmp_path / "outside.webp"
    outside.write_bytes(file.read_bytes())
    file.unlink()
    try:
        file.symlink_to(outside)
    except OSError:
        pytest.skip("Creating filesystem symlinks requires privileges on this platform")
    with pytest.raises(ValueError, match="Symbolic"):
        archive(storage)
    assert outside.read_bytes() == b"fictional avatar bytes"


def test_disk_failure_keeps_existing_backup_and_releases_database_lock(
    storage, monkeypatch
):
    existing = archive(storage, keep=1)

    def fail(*args, **kwargs):
        raise OSError("fictional unavailable disk")

    monkeypatch.setattr(backups.os, "replace", fail)
    with pytest.raises(OSError):
        archive(storage, keep=1)
    assert list(storage[2].iterdir()) == [existing]
    with sqlite3.connect(storage[0], timeout=0) as writer:
        writer.execute("INSERT INTO retained_reviews VALUES ('Writable after failure')")


def test_operator_commands_use_configured_disposable_storage_and_refuse_overwrite(
    storage, tmp_path, settings, monkeypatch
):
    monkeypatch.setitem(settings.DATABASES["default"], "NAME", str(storage[0]))
    settings.MEDIA_ROOT = storage[1]
    output = io.StringIO()
    call_command("backup_club", destination=str(storage[2]), keep=2, stdout=output)
    assert "Copia creada" in output.getvalue()
    source = next(storage[2].glob("*.zip"))
    call_command(
        "restore_club_backup",
        archive=str(source),
        destination=str(tmp_path / "restore"),
        stdout=output,
    )
    assert "Copia restaurada" in output.getvalue()
    with pytest.raises(CommandError):
        call_command(
            "restore_club_backup",
            archive=str(source),
            destination=str(tmp_path / "restore"),
        )


def test_restores_real_migrated_django_schema_and_native_records(tmp_path):
    backend = Path(__file__).resolve().parents[2]
    environment = os.environ | {
        "BOOKCLUB_ENV": "test",
        "DATABASE_PATH": str(tmp_path / "native.sqlite3"),
        "MEDIA_ROOT": str(tmp_path / "media"),
        "BACKUP_TEST_ROOT": str(tmp_path),
        "DJANGO_SETTINGS_MODULE": "config.settings",
    }
    script = """
import os
from pathlib import Path
import django
django.setup()
from django.core.management import call_command
from users.models import User
from books.models import Book
root = Path(os.environ['BACKUP_TEST_ROOT'])
call_command('migrate', verbosity=0)
User.objects.create_user(discord_user_id='123456789012345678',
                        display_name='Fictional restored member', approved=True)
Book.objects.create(title='Fictional restored book', authors=['Fictional author'],
                    status='archivado')
call_command('backup_club', destination=str(root / 'snapshots'), keep=2)
source = next((root / 'snapshots').glob('*.zip'))
call_command('restore_club_backup', archive=str(source),
             destination=str(root / 'recovered'))
"""
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=backend,
        env=environment,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr
    with sqlite3.connect(tmp_path / "recovered" / "database.sqlite3") as restored:
        assert restored.execute("SELECT display_name FROM users_user").fetchone() == (
            "Fictional restored member",
        )
        assert restored.execute("SELECT title FROM books_book").fetchone() == (
            "Fictional restored book",
        )
        assert restored.execute("PRAGMA foreign_key_check").fetchall() == []
