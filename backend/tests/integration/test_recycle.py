"""Real admin recovery/purge workflows and exact retained-history boundaries."""

from datetime import datetime, timedelta, timezone

import pytest
from django.db import IntegrityError, transaction
from django.test import Client
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator

from books.models import Book, BookCompletion
from config.contract import read_contract, resolve
from core.models import ActivityEvent, LiteraryQuote, PurgeRecord
from meetings.models import (
    Meeting,
    MeetingAttendance,
    MeetingHighlight,
    ReadingAssignment,
    ReadingCompletion,
)
from reviews.constants import CRITERIA
from reviews.models import Review
from users.models import CuratorAssignment, User
from votes.models import Vote, VoteCandidate

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
DOC = read_contract()
NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)


@pytest.fixture
def world(monkeypatch):
    clock = [NOW]
    monkeypatch.setattr(django_timezone, "now", lambda: clock[0])
    users = [
        User.objects.create_user(
            f"8100000000000000{i:02d}",
            approved=True,
            role="admin" if i == 0 else "member",
            display_name=f"Fictional reader {i}",
        )
        for i in range(3)
    ]
    CuratorAssignment.objects.create(member=users[2])
    book = Book.objects.create(
        title="Fictional retained book",
        description="PRIVATE_DESCRIPTION",
        status="terminado",
    )
    meeting = Meeting.objects.create(
        book=book, starts_at=NOW, summary_text="PRIVATE_SUMMARY", summary_published=True
    )
    week = ReadingAssignment.objects.create(
        book=book,
        meeting=meeting,
        week_number=1,
        percent_start=0,
        percent_end=25,
        page_start=1,
        page_end=50,
        notes="PRIVATE_NOTES",
    )
    highlight = MeetingHighlight.objects.create(
        meeting=meeting,
        text="PRIVATE_HIGHLIGHT",
        kind="quote",
        position=1,
        published=True,
    )
    quote = LiteraryQuote.objects.create(
        text="PRIVATE_QUOTE", author="Fictional writer", source=None
    )
    return (
        users,
        {
            "book": book,
            "meeting": meeting,
            "week": week,
            "highlight": highlight,
            "quote": quote,
        },
        clock,
    )


def browser(actor=None):
    client = Client(enforce_csrf_checks=True)
    if actor:
        client.force_login(actor)
    client.get("/api/session")
    return client


def api(client, method, path="/api/admin/bin", status=200, csrf=True):
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    response = getattr(client, method)(path, **headers)
    assert response.status_code == status, response.content
    if path.startswith("/api/admin/bin/"):
        template = "/api/admin/bin/{type}/{id}" + (
            "/restore" if path.endswith("/restore") else ""
        )
    elif path.startswith("/api/admin/books/"):
        template = "/api/admin/books/{bookId}"
    elif path.startswith("/api/admin/deletion-preview/"):
        template = "/api/admin/deletion-preview/{type}/{id}"
    else:
        template = path
    schema = resolve(DOC, DOC["paths"][template][method]["responses"][str(status)])[
        "content"
    ]["application/json"]["schema"]
    Draft202012Validator(schema).validate(response.json())
    if path.startswith("/api/admin/bin") or path.startswith(
        "/api/admin/deletion-preview"
    ):
        assert "PRIVATE_" not in str(response.json())
    return response.json()


def route(kind, row, restore=False):
    return f"/api/admin/bin/{kind}/{row.pk}" + ("/restore" if restore else "")


@pytest.mark.parametrize(
    "role", ["anonymous", "member", "curator", "pending", "revoked"]
)
def test_admin_guard_precedes_type_and_lookup_and_fresh_role_changes(world, role):
    users, items, _ = world
    actor = None if role == "anonymous" else users[2] if role == "curator" else users[1]
    client = browser(actor)
    if role in {"pending", "revoked"}:
        User.objects.filter(pk=actor.pk).update(
            approved=False, revoked_at=NOW if role == "revoked" else None
        )
    expected = 401 if role in {"anonymous", "pending", "revoked"} else 403
    api(client, "get", status=expected)
    api(client, "post", "/api/admin/bin/unknown/999999/restore", expected)
    api(client, "delete", "/api/admin/bin/unknown/999999", expected)
    api(client, "delete", f"/api/admin/books/{items['book'].pk}", expected)
    assert not PurgeRecord.objects.exists()


def test_list_safe_labels_all_types_exact_deadline_and_newest_first(world):
    users, items, clock = world
    client = browser(users[0])
    assert api(client, "get") == []
    for index, item in enumerate(items.values()):
        clock[0] = NOW + timedelta(seconds=index)
        item.soft_delete(users[0])
    rows = api(client, "get")
    assert [row["type"] for row in rows] == list(reversed(items))
    assert all(
        not row["expired"] and row["deletedByName"] == users[0].display_name
        for row in rows
    )
    assert all(row["dependencies"] == [] for row in rows if row["type"] == "quote")
    clock[0] = NOW + timedelta(days=30)
    assert (
        next(row for row in api(browser(users[0]), "get") if row["type"] == "book")[
            "expired"
        ]
        is True
    )


@pytest.mark.parametrize("kind", ["book", "meeting", "quote", "week", "highlight"])
def test_restore_only_selected_metadata_without_descendant_cascade(world, kind):
    users, items, _ = world
    row = items[kind]
    row.soft_delete(users[0])
    if kind == "book":
        items["highlight"].soft_delete(users[0])
    api(browser(users[0]), "post", route(kind, row, True))
    row.refresh_from_db()
    assert row.deleted_at is row.deleted_by_id is row.purge_due_at is None
    if kind == "book":
        items["highlight"].refresh_from_db()
        assert items["highlight"].deleted_at is not None
    if kind == "quote":
        assert row.active is True and row.text == "PRIVATE_QUOTE"
    if kind == "highlight":
        assert row.text == "PRIVATE_HIGHLIGHT" and row.published


@pytest.mark.parametrize("offset,expected", [(-1, 200), (0, 409), (1, 409)])
def test_restore_expiry_is_exact_and_atomic(world, offset, expected):
    users, items, clock = world
    row = items["quote"]
    row.soft_delete(users[0])
    clock[0] = NOW + timedelta(days=30, microseconds=offset)
    api(browser(users[0]), "post", route("quote", row, True), expected)
    row.refresh_from_db()
    assert (row.deleted_at is None) == (expected == 200)


@pytest.mark.parametrize(
    "kind,parent",
    [
        ("meeting", "book"),
        ("week", "book"),
        ("week", "meeting"),
        ("highlight", "meeting"),
        ("highlight", "book"),
    ],
)
def test_parent_first_restore_conflicts_leave_every_row_unchanged(world, kind, parent):
    users, items, _ = world
    row = items[kind]
    row.soft_delete(users[0])
    items[parent].soft_delete(users[0])
    api(browser(users[0]), "post", route(kind, row, True), 409)
    row.refresh_from_db()
    assert row.deleted_at == NOW
    assert items["week"].__class__.all_objects.get(pk=items["week"].pk).week_number == 1


def test_meeting_may_restore_with_removed_week_and_records_stay_locked(world):
    users, items, _ = world
    items["week"].soft_delete(users[0])
    items["meeting"].soft_delete(users[0])
    client = browser(users[0])
    api(client, "post", route("meeting", items["meeting"], True))
    response = client.get(f"/api/meetings/{items['meeting'].pk}")
    assert response.status_code == 200 and response.json()["record"] == {
        "status": "lockedNoWeek"
    }
    assert "PRIVATE_" not in str(response.json())


def test_restore_conflict_single_reading_book_and_changed_canonical_link(world):
    users, items, _ = world
    client = browser(users[0])
    book = items["book"]
    book.status = "leyendo"
    book.save(update_fields=["status"])
    book.soft_delete(users[0])
    other = Book.objects.create(title="Fictional alternate", status="leyendo")
    api(client, "post", route("book", book, True), 409)
    book.refresh_from_db()
    assert book.deleted_at == NOW
    other.status = "propuesto"
    other.save(update_fields=["status"])
    api(client, "post", route("book", book, True))
    items["week"].soft_delete(users[0])
    Meeting.objects.filter(pk=items["meeting"].pk).update(book=other)
    api(client, "post", route("week", items["week"], True), 409)


def test_restored_week_reinserts_ordinal_and_preserves_completion(world):
    users, items, _ = world
    row = items["week"]
    second = ReadingAssignment.objects.create(
        book=items["book"],
        week_number=2,
        percent_start=25,
        percent_end=50,
        page_start=51,
        page_end=100,
    )
    ReadingCompletion.objects.create(assignment=row, member=users[1], completed_at=NOW)
    row.soft_delete(users[0])
    ReadingAssignment.objects.filter(pk=second.pk).update(week_number=1)
    api(browser(users[0]), "post", route("week", row, True))
    assert list(
        ReadingAssignment.objects.order_by("week_number").values_list(
            "pk", "week_number"
        )
    ) == [(row.pk, 1), (second.pk, 2)]
    assert ReadingCompletion.objects.get(assignment=row).completed_at == NOW


def test_unknown_nonremoved_missing_targets_and_csrf_refusal(world):
    users, items, _ = world
    client = browser(users[0])
    api(client, "post", route("book", items["book"], True), 404)
    api(client, "delete", route("book", items["book"]), 404)
    api(client, "post", "/api/admin/bin/unknown/1/restore", 400)
    api(client, "delete", "/api/admin/bin/unknown/1", 400)
    api(client, "post", "/api/admin/bin/book/not-native/restore", 404)
    api(client, "delete", f"/api/admin/books/{items['book'].pk}", 403, csrf=False)
    items["quote"].soft_delete(users[0])
    api(client, "post", route("quote", items["quote"], True), 403, csrf=False)
    api(client, "delete", route("quote", items["quote"]), 403, csrf=False)
    User.objects.filter(pk=users[0].pk).update(role="member")
    api(client, "get", status=403)


def test_book_remove_preview_retains_all_business_history_and_hides_member_views(world):
    users, items, _ = world
    book = items["book"]
    Review.objects.create(
        book=book, member=users[1], **dict.fromkeys(CRITERIA, 4), text="PRIVATE_REVIEW"
    )
    BookCompletion.objects.create(book=book, member=users[1], completed_at=NOW)
    assignment = CuratorAssignment.objects.get(current=True)
    vote = Vote.objects.create(curator_assignment=assignment)
    VoteCandidate.objects.create(vote=vote, book=book, position=1)
    ActivityEvent.objects.create(kind="review_available", actor=users[1], book=book)
    client = browser(users[0])
    preview = api(client, "get", f"/api/admin/deletion-preview/book/{book.pk}")
    assert any("valoraciones" in row for row in preview["dependencies"])
    assert any("votaciones" in row for row in preview["dependencies"])
    api(client, "delete", f"/api/admin/books/{book.pk}")
    assert (
        Review.objects.count()
        == VoteCandidate.objects.count()
        == BookCompletion.objects.count()
        == 1
    )
    member = browser(users[1])
    assert member.get(f"/api/books/{book.pk}").status_code == 404
    assert member.get(f"/api/books/{book.pk}/ratings").status_code == 404
    assert member.get(f"/api/meetings/{items['meeting'].pk}").status_code == 404
    assert member.get("/api/home").json()["recentActivity"] == []
    api(client, "post", route("book", book, True))
    assert (
        member.get(f"/api/books/{book.pk}/ratings").json()["club"]["status"]
        == "visible"
    )


@pytest.mark.parametrize("kind", ["book", "meeting", "week"])
def test_purge_refuses_every_retained_container_dependency(world, kind):
    users, items, _ = world
    row = items[kind]
    row.soft_delete(users[0])
    api(browser(users[0]), "delete", route(kind, row), 409)
    assert row.__class__.all_objects.filter(pk=row.pk).exists()
    assert not PurgeRecord.objects.exists()


@pytest.mark.parametrize(
    "reference", ["review", "completion", "candidate", "winner", "origin", "activity"]
)
def test_empty_book_still_refuses_each_protected_business_history(world, reference):
    users, _, _ = world
    book = Book.objects.create(title="Fictional history blocker")
    assignment = CuratorAssignment.objects.get(current=True)
    if reference == "review":
        Review.objects.create(book=book, member=users[1], **dict.fromkeys(CRITERIA, 3))
    elif reference == "completion":
        BookCompletion.objects.create(book=book, member=users[1])
    elif reference == "activity":
        ActivityEvent.objects.create(kind="book_selected", actor=users[0], book=book)
    else:
        vote = Vote.objects.create(curator_assignment=assignment)
        if reference == "candidate":
            VoteCandidate.objects.create(vote=vote, book=book, position=1)
        elif reference == "winner":
            vote.status = "closed"
            vote.opened_at = NOW
            vote.closed_at = NOW
            vote.winning_book = book
            vote.save()
        else:
            book.origin_vote = vote
            book.save(update_fields=["origin_vote"])
    book.soft_delete(users[0])
    api(browser(users[0]), "delete", route("book", book), 409)
    assert not PurgeRecord.objects.exists()


@pytest.mark.parametrize("kind", ["quote", "highlight", "book", "meeting", "week"])
def test_eligible_purge_erases_only_target_and_records_minimal_tombstone(world, kind):
    users, items, _ = world
    if kind == "book":
        row = Book.objects.create(
            title="PRIVATE_EMPTY_BOOK", description="PRIVATE_CONTENT"
        )
    elif kind == "meeting":
        row = Meeting.objects.create(starts_at=NOW, summary_text="PRIVATE_CONTENT")
    elif kind == "week":
        row = ReadingAssignment.objects.create(
            book=items["book"],
            week_number=2,
            percent_start=25,
            percent_end=50,
            page_start=51,
            page_end=100,
            notes="PRIVATE_CONTENT",
        )
    else:
        row = items[kind]
    if kind == "highlight":
        row.speakers.add(users[1])
    row.soft_delete(users[0])
    resource_id = str(row.pk)
    client = browser(users[0])
    api(client, "delete", route(kind, row))
    assert not row.__class__.all_objects.filter(pk=resource_id).exists()
    tombstone = PurgeRecord.objects.get(kind=kind, resource_id=resource_id)
    assert tombstone.actor_id == users[0].pk and tombstone.purged_at == NOW
    assert {field.name for field in PurgeRecord._meta.fields} == {
        "id",
        "kind",
        "resource_id",
        "actor",
        "purged_at",
    }
    api(client, "post", f"/api/admin/bin/{kind}/{resource_id}/restore", 404)
    api(client, "delete", f"/api/admin/bin/{kind}/{resource_id}", 404)
    if kind == "quote":
        LiteraryQuote.objects.create(text="private_quote")


@pytest.mark.parametrize("action", ["remove", "restore", "purge"])
def test_failure_after_operation_rolls_back_metadata_ordinals_and_tombstone(
    world, monkeypatch, action
):
    from core import recycle

    users, items, _ = world
    client = browser(users[0])

    def fail():
        raise RuntimeError("PRIVATE_FAILURE")

    monkeypatch.setattr(recycle, "bin_projection", fail)
    row = items["quote"]
    if action == "remove":
        api(client, "delete", f"/api/admin/books/{items['book'].pk}", 500)
        items["book"].refresh_from_db()
        assert items["book"].deleted_at is None
    else:
        row.soft_delete(users[0])
        api(
            client,
            "post" if action == "restore" else "delete",
            route("quote", row, action == "restore"),
            500,
        )
        row.refresh_from_db()
        assert row.deleted_at == NOW
        assert not PurgeRecord.objects.exists()


def test_purge_cover_cleanup_happens_only_after_commit(world, settings, tmp_path):
    from books.catalogue import COVER_URL, cover_file

    users, _, _ = world
    settings.MEDIA_ROOT = tmp_path
    key = "a" * 32
    file_path = cover_file(key)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(b"fictional cover")
    book = Book.objects.create(
        title="Fictional isolated cover", cover_path=COVER_URL + key
    )
    book.soft_delete(users[0])
    from django.test import TestCase

    with TestCase.captureOnCommitCallbacks(execute=True):
        api(browser(users[0]), "delete", route("book", book))
        assert file_path.exists()
    assert not file_path.exists()


def test_purge_tombstone_sql_constraints(world):
    users, _, _ = world
    for changes in [{"kind": "unknown"}, {"resource_id": "bad-id"}]:
        with pytest.raises(IntegrityError), transaction.atomic():
            PurgeRecord.objects.create(
                kind=changes.get("kind", "book"),
                resource_id=changes.get("resource_id", "42"),
                actor=users[0],
            )


def test_highlight_position_conflict_and_week_projection_failure_are_atomic(
    world, monkeypatch
):
    from core import recycle

    users, items, _ = world
    client = browser(users[0])
    highlight = items["highlight"]
    highlight.soft_delete(users[0])
    MeetingHighlight.objects.create(
        meeting=items["meeting"],
        position=1,
        text="Fictional replacement",
        kind="paraphrase",
    )
    api(client, "post", route("highlight", highlight, True), 409)
    highlight.refresh_from_db()
    assert highlight.deleted_at == NOW
    week = items["week"]
    week.soft_delete(users[0])
    second = ReadingAssignment.objects.create(
        book=items["book"],
        week_number=1,
        percent_start=25,
        percent_end=50,
        page_start=51,
        page_end=100,
    )

    def fail():
        raise RuntimeError("PRIVATE_FAILURE")

    monkeypatch.setattr(recycle, "bin_projection", fail)
    api(client, "post", route("week", week, True), 500)
    week.refresh_from_db()
    second.refresh_from_db()
    assert week.deleted_at == NOW and week.week_number == second.week_number == 1


def test_meeting_attendance_and_activity_and_week_completion_block_purge(world):
    users, items, _ = world
    client = browser(users[0])
    for reference in ["attendance", "activity"]:
        meeting = Meeting.objects.create(starts_at=NOW)
        if reference == "attendance":
            MeetingAttendance.objects.create(meeting=meeting, member=users[1])
        else:
            ActivityEvent.objects.create(
                kind="summary_published", meeting=meeting, actor=users[0]
            )
        meeting.soft_delete(users[0])
        api(client, "delete", route("meeting", meeting), 409)
    week = ReadingAssignment.objects.create(
        book=items["book"],
        week_number=2,
        percent_start=25,
        percent_end=50,
        page_start=51,
        page_end=100,
    )
    ReadingCompletion.objects.create(assignment=week, member=users[1])
    week.soft_delete(users[0])
    api(client, "delete", route("week", week), 409)
    assert not PurgeRecord.objects.exists()
