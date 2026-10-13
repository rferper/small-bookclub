"""Raw JSON proves independent week gates, publication and retained boundaries."""

import json
from datetime import datetime, timezone

import pytest
from django.test import Client
from jsonschema import Draft202012Validator

from books.models import Book, BookCompletion
from config.contract import read_contract, resolve
from meetings.models import (
    Meeting,
    MeetingHighlight,
    ReadingAssignment,
    ReadingCompletion,
)
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 13, 12, tzinfo=timezone.utc)
DOC = read_contract()
PATH = "/api/meetings/{meetingId}"


@pytest.fixture
def setup():
    admin = User.objects.create_user(
        "100000000000000001",
        approved=True,
        role="admin",
        display_name="Fictional admin",
    )
    member = User.objects.create_user(
        "100000000000000002", approved=True, display_name="Fictional reader"
    )
    other = User.objects.create_user(
        "100000000000000003", approved=True, display_name="Fictional other"
    )
    book = Book.objects.create(title="Fictional book", status="leyendo")
    meetings = [
        Meeting.objects.create(
            book=book,
            starts_at=NOW,
            summary_text=f"PRIVATE_SUMMARY_{index}",
            summary_published=True,
            record_safe=True,
        )
        for index in [2, 3]
    ]
    weeks = [
        ReadingAssignment.objects.create(
            book=book,
            meeting=meeting,
            week_number=index,
            percent_start=0,
            percent_end=10,
            page_start=1,
            page_end=10,
        )
        for index, meeting in zip([2, 3], meetings)
    ]
    for meeting in meetings:
        visible = MeetingHighlight.objects.create(
            meeting=meeting,
            position=1,
            text=f"PRIVATE_PUBLISHED_{meeting.pk}",
            kind="quote",
            published=True,
        )
        visible.speakers.add(other)
        MeetingHighlight.objects.create(
            meeting=meeting, position=2, text="PRIVATE_DRAFT", kind="paraphrase"
        )
    return admin, member, other, book, meetings, weeks


def browser(actor=None):
    client = Client(enforce_csrf_checks=True)
    if actor:
        client.force_login(actor)
    client.get("/api/session")
    return client


def detail(client, meeting, status=200, query=""):
    response = client.get(f"/api/meetings/{meeting.pk}{query}", HTTP_HX_REQUEST="true")
    assert response.status_code == status, response.content
    data = response.json()
    schema = resolve(DOC, DOC["paths"][PATH]["get"]["responses"][str(status)])[
        "content"
    ]["application/json"]["schema"]
    Draft202012Validator(schema).validate(data)
    assert "PRIVATE_DRAFT" not in response.content.decode()
    return data


@pytest.mark.parametrize("role", ["admin", "member"])
def test_week_two_unlocks_only_its_published_content_and_unmark_relocks(setup, role):
    admin, member, other, book, meetings, weeks = setup
    actor = admin if role == "admin" else member
    client = browser(actor)
    ReadingCompletion.objects.create(
        assignment=weeks[1], member=other, completed_at=NOW
    )
    BookCompletion.objects.create(book=book, member=actor, completed_at=NOW)
    before = detail(
        client, meetings[0], query="?completedByMe=true&safe=true&role=admin&userId=3"
    )
    assert before["record"] == {"status": "lockedWeekNotRead", "weekNumber": 2}
    assert "PRIVATE" not in json.dumps(before)
    for flag in [True, False]:
        response = client.put(
            f"/api/weeks/{weeks[0].pk}/completion",
            json.dumps({"completed": flag}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
        )
        assert response.status_code == 204
        record = detail(client, meetings[0])["record"]
        if flag:
            assert (
                record["status"] == "visible"
                and record["summary"] == "PRIVATE_SUMMARY_2"
            )
            assert (
                len(record["highlights"]) == 1
                and record["highlights"][0]["kind"] == "quote"
            )
            assert record["highlights"][0]["speakers"][0]["id"] == str(other.pk)
            assert set(record["highlights"][0]) == {"id", "text", "kind", "speakers"}
        else:
            assert record == {"status": "lockedWeekNotRead", "weekNumber": 2}
        hidden = detail(client, meetings[1])
        assert hidden["record"] == {"status": "lockedWeekNotRead", "weekNumber": 3}
        assert "PRIVATE" not in json.dumps(hidden)
    assert (
        ReadingCompletion.objects.get(assignment=weeks[1], member=other).completed_at
        == NOW
    )


@pytest.mark.parametrize(
    "boundary",
    ["cancelled", "removed_week", "foreign_book", "removed_meeting", "removed_book"],
)
def test_retained_boundary_overrides_completion_and_safe_flag(setup, boundary):
    admin, member, _, book, meetings, weeks = setup
    ReadingCompletion.objects.create(
        assignment=weeks[0], member=member, completed_at=NOW
    )
    if boundary == "cancelled":
        Meeting.objects.filter(pk=meetings[0].pk).update(cancelled=True)
    elif boundary == "removed_week":
        weeks[0].soft_delete(admin)
    elif boundary == "foreign_book":
        ReadingAssignment.objects.filter(pk=weeks[0].pk).update(
            book=Book.objects.create(title="Fictional unrelated")
        )
    elif boundary == "removed_meeting":
        meetings[0].soft_delete(admin)
    else:
        book.soft_delete(admin)
    result = detail(
        browser(member),
        meetings[0],
        404 if boundary in ["removed_meeting", "removed_book"] else 200,
    )
    assert "PRIVATE" not in json.dumps(result)
    if "record" in result:
        assert result["record"] == {"status": "lockedNoWeek"}


@pytest.mark.parametrize("role", ["admin", "member"])
def test_unlinked_safe_setting_unlocks_published_only_and_editor_keeps_drafts(
    setup, role
):
    admin, member, _, _, meetings, weeks = setup
    ReadingAssignment.objects.filter(pk=weeks[0].pk).update(meeting=None)
    Meeting.objects.filter(pk=meetings[0].pk).update(
        record_safe=False, summary_published=False
    )
    client = browser(admin if role == "admin" else member)
    assert detail(client, meetings[0])["record"] == {"status": "lockedNoWeek"}
    administrator = browser(admin)
    response = administrator.put(
        f"/api/admin/meetings/{meetings[0].pk}/record/safe",
        json.dumps({"safe": True}),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=administrator.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    result = detail(client, meetings[0])["record"]
    assert result["status"] == "visible" and result["summary"] is None
    assert len(result["highlights"]) == 1
    editor = administrator.get(f"/api/admin/meetings/{meetings[0].pk}/record")
    assert editor.status_code == 200 and b"PRIVATE_DRAFT" in editor.content
    for url in [
        "/api/home",
        "/api/books",
        "/api/meetings",
        f"/api/books/{meetings[0].book_id}",
    ]:
        response = client.get(url)
        assert response.status_code == 200 and b"PRIVATE" not in response.content


def test_deleted_highlights_hidden_empty_visible_record_and_revocation(setup):
    admin, member, other, _, meetings, weeks = setup
    ReadingCompletion.objects.create(
        assignment=weeks[0], member=member, completed_at=NOW
    )
    published = MeetingHighlight.objects.get(meeting=meetings[0], published=True)
    published.soft_delete(admin)
    Meeting.objects.filter(pk=meetings[0].pk).update(summary_published=False)
    client = browser(member)
    assert detail(client, meetings[0])["record"] == {
        "status": "visible",
        "summary": None,
        "highlights": [],
    }
    detail(browser(), meetings[0], 401)
    User.objects.filter(pk=member.pk).update(approved=False, revoked_at=NOW)
    detail(client, meetings[0], 401)
