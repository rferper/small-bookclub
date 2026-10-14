"""Real scheduled-command retention, history, rollback and file retry workflows."""

from datetime import datetime, timedelta, timezone
from io import StringIO
from pathlib import Path

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone as django_timezone

from books.catalogue import COVER_URL, cover_file
from books.models import Book, BookCompletion
from core.models import ActivityEvent, CoverErasure, LiteraryQuote, PurgeRecord
from core.recycle import MODELS, erase_cover, purge_target
from meetings.models import Meeting, MeetingHighlight, ReadingAssignment
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)


@pytest.fixture
def world(monkeypatch, settings, tmp_path):
    clock = [NOW]
    monkeypatch.setattr(django_timezone, "now", lambda: clock[0])
    settings.MEDIA_ROOT = tmp_path
    admin = User.objects.create_user(
        "820000000000000001",
        approved=True,
        role="admin",
        display_name="Fictional admin",
    )
    return admin, clock


def run(admin, **options):
    output = StringIO()
    call_command("purge_expired", actor_id=str(admin.pk), stdout=output, **options)
    return output.getvalue()


def target(kind, admin):
    if kind == "book":
        row = Book.objects.create(title="Fictional isolated book")
    elif kind == "meeting":
        row = Meeting.objects.create(starts_at=NOW)
    elif kind == "week":
        book = Book.objects.create(title="Fictional active parent")
        row = ReadingAssignment.objects.create(
            book=book,
            week_number=1,
            percent_start=0,
            percent_end=25,
            page_start=1,
            page_end=40,
        )
    elif kind == "highlight":
        meeting = Meeting.objects.create(starts_at=NOW)
        row = MeetingHighlight.objects.create(
            meeting=meeting,
            position=1,
            text="Fictional private highlight",
            kind="quote",
        )
        row.speakers.add(admin)
    else:
        row = LiteraryQuote.objects.create(text="Fictional private quote")
    row.soft_delete(admin)
    return row


@pytest.mark.parametrize("kind", list(MODELS))
def test_command_retains_before_deadline_and_erases_at_exact_deadline(world, kind):
    admin, clock = world
    row = target(kind, admin)
    resource_id = str(row.pk)
    clock[0] = NOW + timedelta(days=30) - timedelta(microseconds=1)
    assert "Purgados: 0" in run(admin)
    assert MODELS[kind].all_objects.filter(pk=resource_id).exists()
    clock[0] += timedelta(microseconds=1)
    assert "Purgados: 1" in run(admin)
    assert not MODELS[kind].all_objects.filter(pk=resource_id).exists()
    tombstone = PurgeRecord.objects.get(kind=kind, resource_id=resource_id)
    assert tombstone.actor == admin and tombstone.purged_at == clock[0]
    assert "Purgados: 0" in run(admin)
    assert PurgeRecord.objects.count() == 1


def test_after_deadline_dry_run_is_read_only_and_ignores_active_or_not_due(world):
    admin, clock = world
    expired = target("quote", admin)
    clock[0] = NOW + timedelta(days=31)
    recent = LiteraryQuote.objects.create(text="Fictional recent quote")
    recent.soft_delete(admin)
    active = LiteraryQuote.objects.create(text="Fictional active quote")
    CoverErasure.objects.create(key="a" * 32)
    file = cover_file("a" * 32)
    file.parent.mkdir(parents=True)
    file.write_bytes(b"fictional cover")
    assert "Simulación: elegibles: 1" in run(admin, dry_run=True)
    assert not PurgeRecord.objects.exists() and file.exists()
    assert "Purgados: 1" in run(admin)
    assert not LiteraryQuote.all_objects.filter(pk=expired.pk).exists()
    assert LiteraryQuote.all_objects.filter(pk__in=[recent.pk, active.pk]).count() == 2


@pytest.mark.parametrize(
    "changes",
    [
        {"role": "member"},
        {"approved": False},
        {"approved": False, "revoked_at": NOW},
    ],
)
def test_command_requires_fresh_approved_admin_and_does_not_change_content(
    world, changes
):
    admin, clock = world
    row = target("quote", admin)
    clock[0] = NOW + timedelta(days=31)
    User.objects.filter(pk=admin.pk).update(**changes)
    with pytest.raises(CommandError, match="administrador"):
        run(admin)
    assert LiteraryQuote.all_objects.filter(pk=row.pk).exists()
    assert not PurgeRecord.objects.exists()


@pytest.mark.parametrize("actor_id", ["0", "bad-id", "9999999999999999999", "99999"])
def test_missing_or_invalid_actor_cannot_run(world, actor_id):
    with pytest.raises(CommandError):
        call_command("purge_expired", actor_id=actor_id, stdout=StringIO())


def test_command_preserves_protected_history_and_reports_only_counts(world):
    admin, clock = world
    book = Book.objects.create(title="PRIVATE_TITLE")
    BookCompletion.objects.create(book=book, member=admin, completed_at=None)
    book.soft_delete(admin)
    activity_meeting = Meeting.objects.create(
        starts_at=NOW, summary_text="PRIVATE_TEXT"
    )
    ActivityEvent.objects.create(
        kind="summary_published", meeting=activity_meeting, actor=admin
    )
    activity_meeting.soft_delete(admin)
    clock[0] = NOW + timedelta(days=31)
    output = run(admin)
    assert "bloqueados por historial: 2" in output and "PRIVATE" not in output
    assert Book.all_objects.filter(pk=book.pk).exists()
    assert Meeting.all_objects.filter(pk=activity_meeting.pk).exists()
    assert BookCompletion.objects.count() == ActivityEvent.objects.count() == 1
    assert not PurgeRecord.objects.exists()


def test_expired_children_are_erased_before_eligible_parent(world):
    admin, clock = world
    book = target("book", admin)
    meeting = Meeting.objects.create(book=book, starts_at=NOW)
    highlight = MeetingHighlight.objects.create(
        meeting=meeting, position=1, text="Fictional child", kind="quote"
    )
    for row in (meeting, highlight):
        row.soft_delete(admin)
    clock[0] = NOW + timedelta(days=31)
    assert "Purgados: 3" in run(admin)
    assert PurgeRecord.objects.count() == 3


def test_failed_cover_cleanup_is_queued_and_retried_after_commit(world, monkeypatch):
    admin, clock = world
    key = "b" * 32
    file = cover_file(key)
    file.parent.mkdir(parents=True)
    file.write_bytes(b"fictional cover")
    book = Book.objects.create(
        title="Fictional covered book", cover_path=COVER_URL + key
    )
    book.soft_delete(admin)
    clock[0] = NOW + timedelta(days=31)
    original = Path.unlink

    def deny(path, *args, **kwargs):
        if path == file:
            raise PermissionError("Fictional inaccessible file")
        return original(path, *args, **kwargs)

    monkeypatch.setattr(Path, "unlink", deny)
    with TestCase.captureOnCommitCallbacks(execute=True):
        run(admin)
        assert file.exists()
    assert file.exists() and CoverErasure.objects.filter(pk=key).exists()
    assert PurgeRecord.objects.filter(kind="book", resource_id=str(book.pk)).exists()
    monkeypatch.setattr(Path, "unlink", original)
    with TestCase.captureOnCommitCallbacks(execute=True):
        run(admin)
        assert file.exists()
    assert not file.exists() and not CoverErasure.objects.exists()


def test_shared_cover_is_retained_until_last_book_is_erased(world):
    admin, clock = world
    key = "c" * 32
    file = cover_file(key)
    file.parent.mkdir(parents=True)
    file.write_bytes(b"fictional shared cover")
    books = [
        Book.objects.create(title=f"Fictional shared {i}", cover_path=COVER_URL + key)
        for i in range(2)
    ]
    books[0].soft_delete(admin)
    clock[0] = NOW + timedelta(days=31)
    with TestCase.captureOnCommitCallbacks(execute=True):
        run(admin)
    assert file.exists() and CoverErasure.objects.filter(pk=key).exists()
    books[1].soft_delete(admin)
    clock[0] += timedelta(days=31)
    with TestCase.captureOnCommitCallbacks(execute=True):
        run(admin)
    assert not file.exists() and not CoverErasure.objects.exists()


def test_rollback_does_not_erase_cover_or_leave_tombstone_or_queue(world):
    admin, _ = world
    key = "d" * 32
    file = cover_file(key)
    file.parent.mkdir(parents=True)
    file.write_bytes(b"fictional retained cover")
    book = Book.objects.create(title="Fictional rollback", cover_path=COVER_URL + key)
    book.soft_delete(admin)
    resource_id = book.pk
    with TestCase.captureOnCommitCallbacks(execute=True):
        with pytest.raises(RuntimeError), transaction.atomic():
            purge_target("book", book, admin)
            raise RuntimeError("Fictional rollback")
    assert file.exists() and Book.all_objects.filter(pk=resource_id).exists()
    assert not PurgeRecord.objects.exists() and not CoverErasure.objects.exists()


def test_queue_rejects_invalid_sql_keys_and_cleanup_never_accepts_paths(world):
    for key in ("../private", "A" * 32, "e" * 31):
        with pytest.raises(IntegrityError), transaction.atomic():
            CoverErasure.objects.create(key=key)
        assert erase_cover(key) is False


def test_authority_is_rechecked_between_rows(world, monkeypatch):
    from core.management.commands import purge_expired

    admin, clock = world
    first = target("quote", admin)
    second = LiteraryQuote.objects.create(text="Fictional second removed quote")
    second.soft_delete(admin)
    clock[0] = NOW + timedelta(days=31)
    real_purge = purge_expired.purge_target

    def revoke_after_erasure(kind, row, actor):
        result = real_purge(kind, row, actor)
        User.objects.filter(pk=actor.pk).update(approved=False, revoked_at=clock[0])
        return result

    monkeypatch.setattr(purge_expired, "purge_target", revoke_after_erasure)
    with pytest.raises(CommandError, match="administrador"):
        run(admin)
    assert PurgeRecord.objects.count() == 1
    assert LiteraryQuote.all_objects.filter(pk__in=[first.pk, second.pk]).count() == 1


def test_purge_conflict_rolls_back_row_and_is_counted_as_blocked(world):
    admin, clock = world
    row = target("quote", admin)
    PurgeRecord.objects.create(kind="quote", resource_id=str(row.pk), actor=admin)
    clock[0] = NOW + timedelta(days=31)
    assert "bloqueados por historial: 1" in run(admin)
    assert LiteraryQuote.all_objects.filter(pk=row.pk).exists()
    assert PurgeRecord.objects.count() == 1
