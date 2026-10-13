"""Native member calendar partitioning, retained references and safe projections."""

import json
from datetime import datetime, timedelta, timezone

import pytest
from django.test import Client
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator, FormatChecker

from books.models import Book
from config.contract import read_contract, resolve
from meetings.models import Meeting, ReadingAssignment
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
DOC = read_contract()
NOW = datetime(2026, 10, 25, 1, 30, tzinfo=timezone.utc)


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
    book = Book.objects.create(title="Fictional book", status="leyendo")
    rows = [
        Meeting.objects.create(
            book=book,
            starts_at=NOW + timedelta(days=offset),
            cancelled=offset in [-1, 1],
            summary_text="PRIVATE_SUMMARY_SENTINEL",
            summary_published=True,
            attendance_recorded=True,
        )
        for offset in [2, 0, 1, -2, -1]
    ]
    for row in rows:
        row.attendees.add(admin)
    week = ReadingAssignment.objects.create(
        book=book,
        meeting=rows[1],
        week_number=1,
        percent_start=110,
        percent_end=130,
        page_start=1,
        page_end=100,
        notes="PRIVATE_NOTES_SENTINEL",
    )
    return admin, member, book, rows, week


def browser(identity=None):
    client = Client()
    if identity:
        client.force_login(identity)
    return client


def checked(client, url="/api/meetings", path="/api/meetings", status=200):
    response = client.get(url)
    assert response.status_code == status, response.content
    data = response.json()
    schema = resolve(DOC, DOC["paths"][path]["get"]["responses"][str(status)])[
        "content"
    ]["application/json"]["schema"]
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(data)
    assert "PRIVATE_SUMMARY_SENTINEL" not in json.dumps(data)
    if path == "/api/meetings":
        assert "PRIVATE_NOTES_SENTINEL" not in json.dumps(data)
    return data


@pytest.mark.parametrize("role", ["member", "admin"])
def test_calendar_partitions_with_server_clock_keeps_cancellation_and_omits_records(
    setup, role
):
    admin, member, book, rows, week = setup
    client = browser(admin if role == "admin" else member)
    data = checked(client)
    assert [row["id"] for row in data["upcoming"]] == [
        str(rows[i].pk) for i in [1, 2, 0]
    ]
    assert [row["id"] for row in data["past"]] == [str(rows[i].pk) for i in [4, 3]]
    assert data["upcoming"][1]["cancelled"] is True
    assert data["past"][0]["cancelled"] is True
    assert data["upcoming"][0]["assignment"] == {
        "weekNumber": 1,
        "percentStart": 110,
        "percentEnd": 130,
        "pageStart": 1,
        "pageEnd": 100,
    }
    for row in data["upcoming"] + data["past"]:
        assert set(row) == {"id", "startsAt", "cancelled", "book", "assignment"}
    detail = checked(client, f"/api/books/{book.pk}", "/api/books/{bookId}")
    assert [row["id"] for row in detail["meetings"]] == [
        str(rows[i].pk) for i in [3, 4, 1, 2, 0]
    ]
    assert detail["meetings"][2]["weekNumber"] == 1


@pytest.mark.parametrize("change", ["remove_week", "remove_meeting", "remove_book"])
def test_removed_records_and_references_fail_closed(setup, change):
    admin, member, book, rows, week = setup
    if change == "remove_week":
        week.soft_delete(admin)
    elif change == "remove_meeting":
        rows[1].soft_delete(admin)
    else:
        book.soft_delete(admin)
    data = checked(browser(member))
    if change == "remove_book":
        assert data == {"upcoming": [], "past": []}
    elif change == "remove_meeting":
        assert str(rows[1].pk) not in [row["id"] for row in data["upcoming"]]
    else:
        assert data["upcoming"][0]["assignment"] is None
        detail = checked(
            browser(member), f"/api/books/{book.pk}", "/api/books/{bookId}"
        )
        assert detail["meetings"][2]["weekNumber"] is None


def test_unlinked_meetings_empty_list_and_exact_microsecond_boundary(setup):
    admin, member, book, rows, week = setup
    for row in rows:
        row.soft_delete(admin)
    assert checked(browser(member)) == {"upcoming": [], "past": []}
    past = Meeting.objects.create(starts_at=NOW - timedelta(microseconds=1))
    upcoming = Meeting.objects.create(starts_at=NOW)
    result = checked(browser(member))
    assert result["upcoming"][0]["id"] == str(upcoming.pk)
    assert result["past"][0]["id"] == str(past.pk)
    assert result["upcoming"][0]["book"] is None
    assert result["upcoming"][0]["assignment"] is None


def test_membership_precedes_calendar_reads_and_rechecks_revocation(setup):
    _, member, *_ = setup
    checked(browser(), status=401)
    client = browser(member)
    User.objects.filter(pk=member.pk).update(approved=False, revoked_at=NOW)
    checked(client, status=401)


def test_equal_instants_have_stable_native_id_order(setup):
    _, member, book, rows, _ = setup
    other = Meeting.objects.create(book=book, starts_at=NOW)
    result = checked(browser(member))
    assert [row["id"] for row in result["upcoming"]][:2] == [
        str(rows[1].pk),
        str(other.pk),
    ]
