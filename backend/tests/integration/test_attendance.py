"""Native attendance authority, history, detail readback and migration retention."""

import json
from datetime import datetime, timedelta, timezone

import pytest
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import Client
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator

from books.models import Book
from config.contract import read_contract, resolve
from meetings.models import Meeting, MeetingAttendance
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 13, 12, tzinfo=timezone.utc)
DOC = read_contract()
WRITE = "/api/admin/meetings/{meetingId}/attendance"
READ = "/api/meetings/{meetingId}"


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setattr(django_timezone, "now", lambda: NOW)
    admin = User.objects.create_user(
        "100000000000000001",
        approved=True,
        role="admin",
        display_name="Fictional admin",
    )
    member = User.objects.create_user(
        "100000000000000002", approved=True, display_name="Fictional member"
    )
    revoked = User.objects.create_user(
        "100000000000000003",
        approved=False,
        revoked_at=NOW,
        display_name="Fictional history",
    )
    book = Book.objects.create(title="Fictional book")
    meeting = Meeting.objects.create(
        book=book,
        starts_at=NOW - timedelta(days=1),
        summary_text="PRIVATE_SUMMARY",
        summary_published=True,
    )
    return admin, member, revoked, book, meeting


def browser(actor=None):
    client = Client(enforce_csrf_checks=True)
    if actor:
        client.force_login(actor)
    client.get("/api/session")
    return client


def put(client, meeting, value, csrf=True):
    return client.put(
        WRITE.replace("{meetingId}", str(meeting.pk)),
        json.dumps(value),
        content_type="application/json",
        **({"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}),
    )


def checked(response, status=200, path=WRITE, method="put"):
    assert response.status_code == status, response.content
    result = response.json()
    schema = resolve(DOC, DOC["paths"][path][method]["responses"][str(status)])[
        "content"
    ]["application/json"]["schema"]
    Draft202012Validator(schema).validate(result)
    assert "PRIVATE" not in json.dumps(result)
    return result


def test_admin_replaces_active_attendance_preserves_revoked_and_member_reads_it(setup):
    admin, member, revoked, _, meeting = setup
    assert (
        checked(
            browser(member).get(f"/api/meetings/{meeting.pk}"), path=READ, method="get"
        )["attendance"]
        is None
    )
    meeting.attendees.add(revoked)
    client = browser(admin)
    result = checked(put(client, meeting, {"memberIds": [str(member.pk)]}))
    assert {row["id"] for row in result["attendance"]} == {
        str(member.pk),
        str(revoked.pk),
    }
    checked(put(client, meeting, {"memberIds": [str(member.pk)]}))
    assert MeetingAttendance.objects.count() == 2
    view = checked(
        browser(member).get(f"/api/meetings/{meeting.pk}"), path=READ, method="get"
    )
    assert view["attendance"] == result["attendance"]
    assert view["record"] == {"status": "lockedNoWeek"}
    checked(put(client, meeting, {"memberIds": []}))
    assert set(meeting.attendees.values_list("pk", flat=True)) == {revoked.pk}
    meeting.attendees.clear()
    assert checked(put(client, meeting, {"memberIds": []}))["attendance"] == []
    with pytest.raises(IntegrityError), transaction.atomic():
        MeetingAttendance.objects.create(meeting=meeting, member=member)
        MeetingAttendance.objects.create(meeting=meeting, member=member)


@pytest.mark.parametrize("state", ["now", "future", "cancelled"])
def test_ineligible_attendance_conflicts_before_payload_and_member_read_is_null(
    setup, state
):
    admin, member, _, _, meeting = setup
    if state == "now":
        meeting.starts_at = NOW
    elif state == "future":
        meeting.starts_at = NOW + timedelta(seconds=1)
    else:
        meeting.cancelled = True
    meeting.attendance_recorded = True
    meeting.save()
    meeting.attendees.add(member)
    checked(put(browser(admin), meeting, {}), 409)
    assert (
        checked(
            browser(member).get(f"/api/meetings/{meeting.pk}"), path=READ, method="get"
        )["attendance"]
        is None
    )


@pytest.mark.parametrize(
    "value",
    [
        {},
        {"memberIds": None},
        {"memberIds": [1]},
        {"memberIds": ["999999"]},
        {"memberIds": ["2", "2"]},
        {"memberIds": [], "extra": True},
        {"memberIds": ["3"]},
    ],
)
def test_invalid_selection_never_changes_rows(setup, value):
    admin, member, _, _, meeting = setup
    meeting.attendees.add(member)
    checked(put(browser(admin), meeting, value), 400)
    assert list(meeting.attendees.values_list("pk", flat=True)) == [member.pk]
    meeting.refresh_from_db()
    assert meeting.attendance_recorded is False


def test_authority_csrf_removed_lookup_and_safe_atomic_failure(setup, monkeypatch):
    admin, member, _, book, meeting = setup
    checked(put(browser(), Meeting(pk=999999), {}), 401)
    checked(put(browser(member), Meeting(pk=999999), {}), 403)
    client = browser(admin)
    checked(put(client, meeting, {"memberIds": []}, csrf=False), 403)
    checked(put(client, Meeting(pk=999999), {}), 404)
    meeting.soft_delete(admin)
    checked(put(client, meeting, {}), 404)
    checked(browser(member).get(f"/api/meetings/{meeting.pk}"), 404, READ, "get")
    meeting.restore(admin)
    book.soft_delete(admin)
    checked(browser(member).get(f"/api/meetings/{meeting.pk}"), 404, READ, "get")
    book.restore(admin)

    def fail(*args, **kwargs):
        raise RuntimeError("PRIVATE_FAILURE")

    monkeypatch.setattr(Meeting, "save", fail)
    checked(put(client, meeting, {"memberIds": [str(member.pk)]}), 500)
    assert MeetingAttendance.objects.count() == 0
    User.objects.filter(pk=admin.pk).update(approved=False, revoked_at=NOW)
    checked(put(client, meeting, {"memberIds": []}), 401)


@pytest.mark.django_db(transaction=True)
def test_forward_and_reverse_migration_preserve_legacy_attendance():
    old = [("meetings", "0003_readingcompletion")]
    new = [("meetings", "0004_meetingattendance")]
    executor = MigrationExecutor(connection)
    try:
        executor.migrate(old)
        apps = executor.loader.project_state(old).apps
        actor = apps.get_model("users", "User").objects.create(
            discord_user_id="100000000000000009",
            display_name="Fictional migration",
            approved=True,
            role="member",
        )
        meeting = apps.get_model("meetings", "Meeting").objects.create(starts_at=NOW)
        meeting.attendees.add(actor)
        executor = MigrationExecutor(connection)
        executor.migrate(new)
        apps = executor.loader.project_state(new).apps
        assert list(
            apps.get_model("meetings", "MeetingAttendance").objects.values_list(
                "meeting_id", "member_id"
            )
        ) == [(meeting.pk, actor.pk)]
        executor = MigrationExecutor(connection)
        executor.migrate(old)
        apps = executor.loader.project_state(old).apps
        assert list(
            apps.get_model("meetings", "Meeting")
            .objects.get(pk=meeting.pk)
            .attendees.values_list("pk", flat=True)
        ) == [actor.pk]
    finally:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
