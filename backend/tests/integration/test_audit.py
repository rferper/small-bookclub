"""Real critical-action audit workflows with no private payload disclosure."""

import json
from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import Client
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator

from books.catalogue import METADATA_FIELDS
from books.models import Book
from config.contract import read_contract, resolve
from core.audit import LABELS
from core.models import AuditEvent, LiteraryQuote
from meetings.models import Meeting, MeetingHighlight, ReadingAssignment
from users.models import CuratorAssignment, User
from votes.models import Vote, VoteCandidate

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
DOC = read_contract()


@pytest.fixture
def world(monkeypatch):
    clock = [NOW]
    monkeypatch.setattr(django_timezone, "now", lambda: clock[0])
    users = [
        User.objects.create_user(
            f"8400000000000000{i:02d}",
            approved=True,
            role="admin" if i == 0 else "member",
            display_name=f"Fictional actor {i}",
        )
        for i in range(3)
    ]
    assignment = CuratorAssignment.objects.create(member=users[1], assigned_at=NOW)
    book = Book.objects.create(
        title="PRIVATE_BOOK_TITLE", description="PRIVATE_DESCRIPTION"
    )
    meeting = Meeting.objects.create(
        book=book, starts_at=NOW, summary_text="PRIVATE_SUMMARY"
    )
    week = ReadingAssignment.objects.create(
        book=book,
        week_number=1,
        percent_start=0,
        percent_end=25,
        page_start=1,
        page_end=42,
    )
    return users, assignment, book, meeting, week, clock


def browser(actor=None):
    client = Client(enforce_csrf_checks=True)
    if actor:
        client.force_login(actor)
    client.get("/api/session")
    return client


def write(client, method, path, data=None, status=200, csrf=True, content_type=None):
    kwargs = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    if data is not None:
        kwargs["data"] = data if content_type else json.dumps(data)
        kwargs["content_type"] = content_type or "application/json"
    response = getattr(client, method)(path, **kwargs)
    assert response.status_code == status, response.content[:400]
    return response


def events(client):
    response = client.get("/api/admin/audit-log")
    assert response.status_code == 200, response.content
    schema = resolve(
        DOC, DOC["paths"]["/api/admin/audit-log"]["get"]["responses"]["200"]
    )["content"]["application/json"]["schema"]
    Draft202012Validator(schema).validate(response.json())
    assert "PRIVATE_" not in response.content.decode()
    return response.json()


@pytest.mark.parametrize("identity,status", [(None, 401), (1, 403), (2, 403)])
def test_audit_is_admin_only_even_for_current_curator(world, identity, status):
    users, *_ = world
    response = browser(users[identity] if identity is not None else None).get(
        "/api/admin/audit-log"
    )
    assert response.status_code == status
    assert "PRIVATE_" not in response.content.decode()
    assert not AuditEvent.objects.exists()


def test_empty_read_is_not_a_transition_and_has_no_edit_delete_route(world):
    client = browser(world[0][0])
    assert events(client) == events(client) == []
    for method in ["put", "post", "delete"]:
        write(client, method, "/api/admin/audit-log", status=405)
    assert not AuditEvent.objects.exists()


def test_member_approval_revoke_restore_and_curator_clear_have_exact_safe_events(world):
    users, _, *_ = world
    client = browser(users[0])
    write(
        client,
        "post",
        "/api/admin/members",
        {"discordId": "840000000000000099", "displayName": "Fictional new reader"},
        201,
    )
    added = User.objects.get(discord_user_id="840000000000000099")
    write(
        client,
        "post",
        "/api/admin/members",
        {"discordId": added.discord_user_id, "displayName": "Different"},
        409,
    )
    write(client, "post", f"/api/admin/members/{users[1].pk}/revoke")
    write(client, "post", f"/api/admin/members/{users[1].pk}/revoke", status=409)
    write(client, "post", f"/api/admin/members/{users[1].pk}/restore")
    write(client, "post", f"/api/admin/members/{users[1].pk}/restore", status=409)
    rows = events(client)
    assert sorted(row["action"] for row in rows) == [
        "curator_cleared",
        "member_approved",
        "member_restored",
        "member_revoked",
    ]
    assert all(row["actor"]["id"] == str(users[0].pk) for row in rows)
    assert all(row["target"]["label"] in ["Miembro", "Curaduría"] for row in rows)


def test_curator_same_assignment_is_noop_and_switch_clear_are_recorded(world):
    users, *_ = world
    client = browser(users[0])
    write(client, "put", "/api/admin/curator", {"memberId": str(users[1].pk)})
    assert events(client) == []
    write(client, "put", "/api/admin/curator", {"memberId": str(users[2].pk)})
    write(client, "put", "/api/admin/curator", {"memberId": None})
    write(client, "put", "/api/admin/curator", {"memberId": None})
    assert AuditEvent.objects.filter(action="curator_assigned").count() == 1
    assert AuditEvent.objects.filter(action="curator_cleared").count() == 2
    assert len(events(client)) == 3


def test_status_changes_ignore_same_status_and_metadata_edits(world):
    users, _, book, *_ = world
    client = browser(users[0])
    metadata = {wire: getattr(book, field) for wire, field in METADATA_FIELDS.items()}
    metadata["coverAction"] = "keep"
    for status in ["propuesto", "elegido", "elegido", "leyendo"]:
        metadata["status"] = status
        data = encode_multipart(
            BOUNDARY,
            {
                "metadata": SimpleUploadedFile(
                    "metadata.json",
                    json.dumps(metadata).encode(),
                    content_type="application/json",
                )
            },
        )
        write(
            client,
            "put",
            f"/api/admin/books/{book.pk}",
            data,
            content_type=MULTIPART_CONTENT,
        )
    rows = events(client)
    assert len(rows) == 2 and all(
        row["action"] == "book_status_changed" for row in rows
    )
    assert all(row["target"]["label"] == "Libro" for row in rows)


def test_summary_and_highlight_publication_changes_never_copy_prose(world):
    users, _, _, meeting, *_ = world
    client = browser(users[0])
    base = f"/api/admin/meetings/{meeting.pk}/record"
    for published in [False, True, True, False]:
        write(
            client,
            "put",
            base + "/summary",
            {"text": "PRIVATE_SUMMARY_EDIT", "published": published},
        )
    result = write(
        client,
        "post",
        base + "/highlights",
        {
            "text": "PRIVATE_HIGHLIGHT",
            "kind": "quote",
            "speakerIds": [str(users[2].pk)],
            "published": True,
        },
        201,
    ).json()
    highlight = result["highlights"][0]["id"]
    for published in [True, False]:
        write(
            client,
            "put",
            base + "/highlights/" + highlight,
            {
                "text": "PRIVATE_HIGHLIGHT_EDIT",
                "kind": "quote",
                "speakerIds": [str(users[2].pk)],
                "published": published,
            },
        )
    assert sorted(row["action"] for row in events(client)) == [
        "highlight_published",
        "highlight_unpublished",
        "summary_published",
        "summary_unpublished",
    ]


def removed_target(kind, world):
    users, _, book, meeting, week, *_ = world
    if kind == "book":
        row = Book.objects.create(title="PRIVATE_ISOLATED_BOOK")
        route = f"/api/admin/books/{row.pk}"
    elif kind == "meeting":
        row = Meeting.objects.create(starts_at=NOW)
        route = f"/api/admin/meetings/{row.pk}"
    elif kind == "week":
        row = week
        route = f"/api/admin/books/{book.pk}/reading-plan/weeks/{row.pk}"
    elif kind == "highlight":
        row = MeetingHighlight.objects.create(
            meeting=meeting, position=1, text="PRIVATE_HIGHLIGHT", kind="quote"
        )
        route = f"/api/admin/meetings/{meeting.pk}/record/highlights/{row.pk}"
    else:
        row = LiteraryQuote.objects.create(text="PRIVATE_QUOTE")
        route = f"/api/admin/quotes/{row.pk}"
    return row, route


@pytest.mark.parametrize("kind", ["book", "meeting", "week", "highlight", "quote"])
def test_soft_delete_restore_purge_hooks_are_row_local_and_survive_erasure(world, kind):
    client = browser(world[0][0])
    row, route = removed_target(kind, world)
    key = str(row.pk)
    write(client, "delete", route)
    write(client, "delete", route, status=404)
    write(client, "post", f"/api/admin/bin/{kind}/{key}/restore")
    write(client, "delete", route)
    write(client, "delete", f"/api/admin/bin/{kind}/{key}")
    rows = events(client)
    assert sorted(item["action"] for item in rows) == [
        "purged",
        "restored",
        "soft_deleted",
        "soft_deleted",
    ]
    assert all(
        item["target"] == {"type": kind, "id": key, "label": LABELS[kind]}
        for item in rows
    )
    assert not type(row).all_objects.filter(pk=key).exists()


def test_curator_closure_and_admin_tie_resolution_are_audited_once_without_notes(world):
    users, assignment, book, *_ = world
    second = Book.objects.create(title="PRIVATE_SECOND_CANDIDATE")
    vote = Vote.objects.create(
        curator_assignment=assignment, status="open", opened_at=NOW
    )
    for index, row in enumerate([book, second], 1):
        VoteCandidate.objects.create(vote=vote, book=row, position=index)
    curator = browser(users[1])
    write(curator, "post", f"/api/votes/{vote.pk}/close")
    write(curator, "post", f"/api/votes/{vote.pk}/close", status=409)
    admin = browser(users[0])
    write(
        admin,
        "post",
        f"/api/votes/{vote.pk}/tie-winner",
        {"bookId": str(book.pk), "note": "PRIVATE_TIE_NOTE"},
    )
    write(
        admin,
        "post",
        f"/api/votes/{vote.pk}/tie-winner",
        {"bookId": str(book.pk), "note": "PRIVATE_TIE_NOTE"},
        409,
    )
    rows = events(admin)
    assert sorted(row["action"] for row in rows) == ["tie_resolved", "vote_closed"]
    assert next(row for row in rows if row["action"] == "vote_closed")["actor"][
        "id"
    ] == str(users[1].pk)


def test_auto_purge_uses_same_recorder_and_repeated_command_is_noop(world):
    users, *_ = world
    quote = LiteraryQuote.objects.create(text="PRIVATE_EXPIRED_QUOTE")
    quote.soft_delete(users[0])
    world[-1][0] = NOW + timedelta(days=31)
    from io import StringIO

    for _ in range(2):
        call_command("purge_expired", actor_id=str(users[0].pk), stdout=StringIO())
    client = browser(users[0])
    assert sorted(row["action"] for row in events(client)) == ["purged", "soft_deleted"]


def test_audit_attribution_is_snapshotted_and_sort_is_time_then_descending_uuid(world):
    users, *_ = world
    for key in [UUID(int=1), UUID(int=2)]:
        AuditEvent.objects.create(
            id=key, actor=users[0], actor_name=users[0].display_name
        )
    User.objects.filter(pk=users[0].pk).update(
        display_name="Renamed fictional actor", approved=False, revoked_at=NOW
    )
    admin = User.objects.create_user(
        "840000000000000098",
        approved=True,
        role="admin",
        display_name="Other fictional admin",
    )
    rows = events(browser(admin))
    assert [row["id"] for row in rows] == [str(UUID(int=2)), str(UUID(int=1))]
    assert all(row["actor"]["displayName"] == "Fictional actor 0" for row in rows)


def test_failed_audit_write_rolls_back_business_transition_and_returns_safe_error(
    world, monkeypatch
):
    users, *_ = world

    def fail(*args, **kwargs):
        raise RuntimeError("PRIVATE_AUDIT_FAILURE")

    monkeypatch.setattr(AuditEvent.objects, "create", fail)
    response = write(
        browser(users[0]),
        "post",
        "/api/admin/members",
        {"discordId": "840000000000000097", "displayName": "Fictional rollback"},
        500,
    )
    assert "PRIVATE_" not in response.content.decode()
    assert not User.objects.filter(discord_user_id="840000000000000097").exists()
    assert not AuditEvent.objects.exists()


def test_csrf_and_refusals_do_not_create_events_and_stale_admin_cannot_read(world):
    users, *_ = world
    client = browser(users[0])
    write(
        client,
        "post",
        "/api/admin/members",
        {"discordId": "840000000000000097", "displayName": "Fictional denied"},
        403,
        csrf=False,
    )
    write(
        client,
        "post",
        "/api/admin/members",
        {"discordId": "invalid", "displayName": "Fictional denied"},
        400,
    )
    assert not AuditEvent.objects.exists()
    User.objects.filter(pk=users[0].pk).update(role="member")
    assert client.get("/api/admin/audit-log").status_code == 403
    User.objects.filter(pk=users[0].pk).update(approved=False, revoked_at=NOW)
    assert client.get("/api/admin/audit-log").status_code == 401


@pytest.mark.parametrize(
    "changes",
    [
        {"action": "unknown"},
        {"target_id": "../private"},
        {"target_label": "PRIVATE_PROSE"},
        {"action": "soft_deleted", "target_type": "club"},
    ],
)
def test_sql_rejects_unknown_action_wrong_subject_or_sensitive_label(world, changes):
    with pytest.raises(IntegrityError), transaction.atomic():
        AuditEvent.objects.create(
            actor=world[0][0], actor_name="Fictional actor", **changes
        )


@pytest.mark.django_db(transaction=True)
def test_existing_export_event_migration_preserves_identity_time_and_snapshot():
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    old = [("core", "0006_exportevent")]
    try:
        executor.migrate(old)
        state = executor.loader.project_state(old).apps
        actor = User.objects.create_user(
            "840000000000000096",
            approved=True,
            role="admin",
            display_name="Fictional legacy actor",
        )
        previous = state.get_model("core", "ExportEvent").objects.create(
            actor_id=actor.pk, actor_name="Original fictional snapshot"
        )
        event_id, occurred = previous.pk, previous.occurred_at
        MigrationExecutor(connection).migrate(latest)
        event = AuditEvent.objects.get(pk=event_id)
        assert (
            event.actor_id == actor.pk
            and event.actor_name == "Original fictional snapshot"
        )
        assert event.occurred_at == occurred and event.action == "exported"
        assert (event.target_type, event.target_id, event.target_label) == (
            "club",
            "club",
            "Club de lectura",
        )
    finally:
        MigrationExecutor(connection).migrate(latest)
