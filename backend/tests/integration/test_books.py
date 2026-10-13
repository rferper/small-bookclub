"""Manual catalogue storage and active-book safety through services and SQL."""

import os
import sqlite3
import subprocess
import sys
from datetime import date, datetime
from datetime import timezone as datetime_timezone
from pathlib import Path

import pytest
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from books.models import Book
from books.services import ActiveBookConflict, set_book_status
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]


@pytest.fixture
def administrator():
    return User.objects.create_user(
        "100000000000000001",
        display_name="Fictional admin",
        role="admin",
        approved=True,
    )


def test_catalogue_facts_normalize_and_persist_with_no_automatic_status():
    book = Book(
        title="  Fictional title  ",
        authors=["  Fictional author  ", " "],
        description="  Fictional description  ",
        publication_date="  circa 1890  ",
        publisher="  Fictional publisher  ",
        isbn="  Fictional edition ID  ",
        page_count=180,
        external_ids={"openLibrary": "/books/OLfictionalM"},
        reading_start_date=date(1990, 1, 1),
        reading_end_date=date(1990, 2, 1),
        planned_start_date=date(1989, 12, 1),
        planned_end_date=date(1989, 12, 31),
        dates_approximate=True,
    )
    book.full_clean()
    book.save()
    book.refresh_from_db()
    assert book.title == "Fictional title"
    assert book.authors == ["Fictional author"]
    assert book.publication_date == "circa 1890"
    assert book.external_ids == {"openLibrary": "/books/OLfictionalM"}
    assert book.status == "propuesto"
    assert book.dates_approximate
    assert book.deleted_at is None and book.cover_path == ""


@pytest.mark.parametrize(
    "fields",
    [
        {"title": " "},
        {"title": 5},
        {"title": "x" * 201},
        {"authors": "Author"},
        {"authors": [None]},
        {"authors": ["x" * 121]},
        {"authors": ["Author"] * 21},
        {"description": "x" * 5001},
        {"publication_date": "x" * 101},
        {"page_count": 0},
        {"page_count": True},
        {"page_count": 9007199254740992},
        {"status": "unknown"},
        {"dates_approximate": "false"},
        {"external_ids": []},
        {"external_ids": {"key": 1}},
        {"reading_start_date": "0000-01-01", "reading_end_date": date(2026, 1, 1)},
        {"reading_start_date": date(2026, 2, 1), "reading_end_date": date(2026, 1, 1)},
        {"planned_start_date": date(2026, 2, 1), "planned_end_date": date(2026, 1, 1)},
    ],
)
def test_model_rejects_invalid_manual_metadata(fields):
    with pytest.raises(ValidationError):
        Book(**{"title": "Fictional", **fields}).full_clean()


def test_database_rejects_second_reading_book_even_without_validation():
    first = Book.objects.create(title="First fictional", status="leyendo")
    second = Book.objects.create(title="Second fictional")
    with pytest.raises(IntegrityError), transaction.atomic():
        Book.objects.filter(pk=second.pk).update(status="leyendo")
    with pytest.raises(IntegrityError), transaction.atomic():
        Book.objects.bulk_create([Book(title="Third fictional", status="leyendo")])
    assert list(Book.objects.filter(status="leyendo").values_list("pk", flat=True)) == [
        first.pk
    ]
    second.refresh_from_db()
    assert second.status == "propuesto"


@pytest.mark.parametrize(
    "fields",
    [
        {"status": "invalid"},
        {"page_count": 0},
        {"page_count": 9007199254740992},
        {"reading_start_date": date(2026, 2, 1), "reading_end_date": date(2026, 1, 1)},
        {"planned_start_date": date(2026, 2, 1), "planned_end_date": date(2026, 1, 1)},
    ],
)
def test_sql_rejects_invalid_domain_values(fields):
    row = Book.objects.create(title="Fictional")
    with pytest.raises(IntegrityError), transaction.atomic():
        Book.objects.filter(pk=row.pk).update(**fields)


def test_status_service_refuses_conflict_without_demoting_other_book(administrator):
    first = Book.objects.create(title="First fictional", status="leyendo")
    second = Book.objects.create(
        title="Second fictional", reading_start_date=date(1990, 1, 1)
    )
    with pytest.raises(ActiveBookConflict):
        set_book_status(administrator, second.pk, "leyendo")
    first.refresh_from_db()
    second.refresh_from_db()
    assert first.status == "leyendo" and second.status == "propuesto"
    set_book_status(administrator, first.pk, "terminado")
    result = set_book_status(administrator, second.pk, "leyendo")
    assert (
        result.reading_start_date == date(1990, 1, 1)
        and result.reading_end_date is None
    )
    assert Book.objects.get(pk=first.pk).reading_end_date is None


def test_removed_reading_book_frees_slot_but_conflicting_restore_rolls_back(
    administrator, monkeypatch
):
    monkeypatch.setattr(
        timezone, "now", lambda: datetime(2026, 1, 1, tzinfo=datetime_timezone.utc)
    )
    removed = Book.objects.create(title="Removed fictional", status="leyendo")
    removed.soft_delete(administrator)
    active = Book.objects.create(title="Active fictional", status="leyendo")
    with pytest.raises(IntegrityError), transaction.atomic():
        removed.restore(administrator)
    removed.refresh_from_db()
    assert removed.deleted_at is not None
    assert list(Book.objects.filter(status="leyendo").values_list("pk", flat=True)) == [
        active.pk
    ]
    set_book_status(administrator, active.pk, "terminado")
    assert removed.restore(administrator)
    assert Book.objects.get(pk=removed.pk).status == "leyendo"


@pytest.mark.parametrize(
    "state", ["member", "pending", "revoked", "unsaved", "anonymous"]
)
def test_status_service_rechecks_admin_before_target_lookup(administrator, state):
    supplied = administrator
    if state == "member":
        User.objects.filter(pk=administrator.pk).update(role="member")
    elif state == "pending":
        User.objects.filter(pk=administrator.pk).update(approved=False)
    elif state == "revoked":
        User.objects.filter(pk=administrator.pk).update(
            approved=False, revoked_at=timezone.now()
        )
    elif state == "unsaved":
        supplied = User(pk=administrator.pk, role="admin", approved=True)
    else:
        supplied = None
    with pytest.raises(PermissionDenied):
        set_book_status(supplied, 999999, "leyendo")


def test_removed_book_and_invalid_status_cannot_be_changed(administrator):
    row = Book.objects.create(title="Fictional")
    with pytest.raises(ValidationError):
        set_book_status(administrator, row.pk, [])
    row.soft_delete(administrator)
    with pytest.raises(Book.DoesNotExist):
        set_book_status(administrator, row.pk, "leyendo")


def test_initial_book_migration_on_fresh_disposable_database(tmp_path):
    database = tmp_path / "fresh-books.sqlite3"
    environment = {**os.environ, "DATABASE_PATH": str(database), "BOOKCLUB_ENV": "test"}
    result = subprocess.run(
        [sys.executable, "manage.py", "migrate", "--noinput"],
        cwd=Path(__file__).resolve().parents[2],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    with sqlite3.connect(database) as connection:
        columns = connection.execute("PRAGMA table_info(books_book)").fetchall()
        assert any(column[1] == "origin_vote_id" for column in columns)
        foreign_keys = connection.execute(
            "PRAGMA foreign_key_list(books_book)"
        ).fetchall()
        assert any(
            row[2] == "votes_vote" and row[3] == "origin_vote_id"
            for row in foreign_keys
        )
        indexes = connection.execute("PRAGMA index_list(books_book)").fetchall()
        assert any(
            index[1] == "book_one_active_reading" and index[2] == 1 and index[4] == 1
            for index in indexes
        )
