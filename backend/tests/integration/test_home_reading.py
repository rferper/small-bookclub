"""Native home target selection and spoiler-free completion readback."""

import json
from datetime import datetime, timedelta, timezone

import pytest
from django.test import Client
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator, FormatChecker

from books.models import Book, BookCompletion
from config.contract import read_contract, resolve
from meetings.models import Meeting, ReadingAssignment, ReadingCompletion
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 25, 1, 30, tzinfo=timezone.utc)
DOC = read_contract()


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
    book = Book.objects.create(
        title="Fictional current book", authors=["Fictional author"], status="leyendo"
    )
    meeting = Meeting.objects.create(
        book=book,
        starts_at=NOW,
        summary_text="PRIVATE_SUMMARY_SENTINEL",
        summary_published=True,
    )
    week = ReadingAssignment.objects.create(
        book=book,
        meeting=meeting,
        week_number=1,
        percent_start=101.5,
        percent_end=125.5,
        page_start=205,
        page_end=330,
        due_date="2000-01-01",
        notes="PRIVATE_OPERATIONAL_SENTINEL",
    )
    return admin, member, book, meeting, week


def browser(identity=None):
    client = Client(enforce_csrf_checks=True)
    if identity:
        client.force_login(identity)
    client.get("/api/session")
    return client


def home(client, status=200):
    response = client.get("/api/home")
    assert response.status_code == status, response.content
    schema = resolve(DOC, DOC["paths"]["/api/home"]["get"]["responses"][str(status)])[
        "content"
    ]["application/json"]["schema"]
    result = response.json()
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(result)
    assert "PRIVATE_" not in json.dumps(result)
    return result


@pytest.mark.parametrize("role", ["member", "admin"])
def test_home_projects_exact_native_ranges_and_only_own_week_flag(setup, role):
    admin, member, book, meeting, week = setup
    actor, other = (admin, member) if role == "admin" else (member, admin)
    ReadingCompletion.objects.create(assignment=week, member=other, completed_at=NOW)
    BookCompletion.objects.create(book=book, member=actor, completed_at=NOW)
    client = browser(actor)
    result = home(client)
    assert result["currentBook"] == {
        "id": str(book.pk),
        "title": book.title,
        "authors": book.authors,
        "coverUrl": None,
    }
    assert result["currentWeek"] == {
        "id": str(week.pk),
        "weekNumber": 1,
        "percentStart": 101.5,
        "percentEnd": 125.5,
        "pageStart": 205,
        "pageEnd": 330,
        "meetingStartsAt": "2026-10-25T01:30:00Z",
        "completedByMe": False,
    }
    assert result["nextMeeting"]["id"] == str(meeting.pk)
    assert result["nextMeeting"]["assignment"]["percentEnd"] == 125.5
    assert len(result["memberProgress"]) == 2
    assert result["recentActivity"] == [] and result["quote"] is None
    assert result["stats"] == {"booksCompleted": 0, "reviews": 0, "members": 2}
    response = client.put(
        f"/api/weeks/{week.pk}/completion",
        json.dumps({"completed": True}),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 204
    assert home(client)["currentWeek"]["completedByMe"] is True
    assert ReadingCompletion.objects.get(member=other).completed_at == NOW


def test_home_refuses_anonymous_pending_and_revoked_members(setup):
    admin, member, *_ = setup
    home(browser(), 401)
    client = browser(member)
    User.objects.filter(pk=member.pk).update(approved=False)
    home(client, 401)
    User.objects.filter(pk=member.pk).update(approved=False, revoked_at=NOW)
    home(client, 401)


@pytest.mark.parametrize(
    "change",
    [
        "finished_book",
        "removed_book",
        "removed_week",
        "removed_meeting",
        "cancelled",
        "past",
        "unlinked",
    ],
)
def test_current_target_disappears_without_automatic_completion(setup, change):
    admin, member, book, meeting, week = setup
    ReadingCompletion.objects.create(assignment=week, member=member, completed_at=NOW)
    if change == "finished_book":
        Book.objects.filter(pk=book.pk).update(status="terminado")
    elif change == "removed_book":
        book.soft_delete(admin)
    elif change == "removed_week":
        week.soft_delete(admin)
    elif change == "removed_meeting":
        meeting.soft_delete(admin)
    elif change == "cancelled":
        Meeting.objects.filter(pk=meeting.pk).update(cancelled=True)
    elif change == "past":
        Meeting.objects.filter(pk=meeting.pk).update(
            starts_at=NOW - timedelta(microseconds=1)
        )
    else:
        ReadingAssignment.objects.filter(pk=week.pk).update(meeting=None)
    result = home(browser(member))
    assert result["currentWeek"] is None
    assert (result["currentBook"] is None) == (
        change in {"finished_book", "removed_book"}
    )
    assert ReadingCompletion.objects.get(member=member).completed_at == NOW


def test_next_meeting_rule_does_not_skip_an_unassigned_meeting(setup):
    _, member, book, meeting, week = setup
    Meeting.objects.filter(pk=meeting.pk).update(starts_at=NOW + timedelta(days=1))
    Meeting.objects.create(starts_at=NOW, book=None)
    assert home(browser(member))["currentWeek"] is None


def test_equal_time_meetings_use_native_id_tiebreaker_and_due_date_is_inert(setup):
    _, member, book, meeting, week = setup
    other = Meeting.objects.create(starts_at=NOW, book=book)
    ReadingAssignment.objects.create(
        book=book,
        meeting=other,
        week_number=2,
        percent_start=0,
        percent_end=10,
        page_start=1,
        page_end=10,
        due_date="2100-01-01",
    )
    assert home(browser(member))["currentWeek"]["id"] == str(week.pk)


def test_different_book_assignment_and_no_active_book_have_friendly_nulls(setup):
    _, member, book, meeting, week = setup
    old = Book.objects.create(title="Fictional archive", status="archivado")
    ReadingAssignment.objects.filter(pk=week.pk).update(book=old)
    Meeting.objects.filter(pk=meeting.pk).update(book=old)
    assert home(browser(member))["currentWeek"] is None
    Book.objects.filter(pk=book.pk).update(status="terminado")
    result = home(browser(member))
    assert result["currentBook"] is None and result["currentWeek"] is None


def test_removed_parent_meeting_cannot_supplant_current_target(setup):
    admin, member, book, meeting, week = setup
    Meeting.objects.filter(pk=meeting.pk).update(starts_at=NOW + timedelta(hours=1))
    old = Book.objects.create(title="Fictional removed book", status="terminado")
    Meeting.objects.create(starts_at=NOW, book=old)
    old.soft_delete(admin)
    assert home(browser(member))["currentWeek"]["id"] == str(week.pk)


def checked_get(client, url, path, status=200):
    response = client.get(url)
    assert response.status_code == status, response.content
    schema = resolve(DOC, DOC["paths"][path]["get"]["responses"][str(status)])[
        "content"
    ]["application/json"]["schema"]
    result = response.json()
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(result)
    return result


@pytest.mark.parametrize("viewer", ["admin", "member"])
def test_social_progress_is_active_only_name_order_and_agrees_with_directory_profiles(
    setup, viewer
):
    admin, member, book, meeting, week = setup
    User.objects.filter(pk=admin.pk).update(display_name="Óscar")
    User.objects.filter(pk=member.pk).update(display_name="Nora")
    extra = [
        User.objects.create_user(
            f"1000000000000000{index:02d}", approved=True, display_name=name
        )
        for index, name in [(3, "Ñora"), (4, "Álba")]
    ]
    revoked = User.objects.create_user(
        "100000000000000005",
        approved=False,
        revoked_at=NOW,
        display_name="PRIVATE_REVOKED_SENTINEL",
    )
    User.objects.create_user(
        "100000000000000006", approved=False, display_name="PRIVATE_PENDING_SENTINEL"
    )
    for reader in [admin, extra[1], revoked]:
        ReadingCompletion.objects.create(
            assignment=week, member=reader, completed_at=NOW
        )
    client = browser(admin if viewer == "admin" else member)
    result = home(client)
    assert [row["member"]["displayName"] for row in result["memberProgress"]] == [
        "Álba",
        "Nora",
        "Ñora",
        "Óscar",
    ]
    assert [row["completed"] for row in result["memberProgress"]] == [
        True,
        False,
        False,
        True,
    ]
    assert result["stats"]["members"] == 4
    directory = checked_get(client, "/api/members", "/api/members")
    assert directory["currentWeekNumber"] == week.week_number
    assert [
        {"member": row["member"], "completed": row["completedCurrentWeek"]}
        for row in directory["members"]
    ] == result["memberProgress"]
    for row in directory["members"]:
        profile = checked_get(
            client, f"/api/members/{row['member']['id']}", "/api/members/{memberId}"
        )
        assert profile["currentWeek"] == {
            "weekNumber": week.week_number,
            "completed": row["completedCurrentWeek"],
        }
        assert set(row["member"]) == {"id", "displayName", "avatarUrl"}
    checked_get(client, f"/api/members/{revoked.pk}", "/api/members/{memberId}", 404)
    # No existing row means an explicit toggle must create the pair.
    response = client.put(
        f"/api/weeks/{week.pk}/completion",
        json.dumps({"completed": True}),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 204
    updated = home(client)
    mine = next(
        row
        for row in updated["memberProgress"]
        if row["member"]["id"] == str(admin.pk if viewer == "admin" else member.pk)
    )
    assert mine["completed"] is True
    changed_directory = checked_get(client, "/api/members", "/api/members")
    assert (
        next(row for row in changed_directory["members"] if row["isMe"])[
            "completedCurrentWeek"
        ]
        is True
    )
    own_id = admin.pk if viewer == "admin" else member.pk
    assert (
        checked_get(client, f"/api/members/{own_id}", "/api/members/{memberId}")[
            "currentWeek"
        ]["completed"]
        is True
    )


@pytest.mark.parametrize("change", ["remove_week", "finish_book", "unlinked_meeting"])
def test_next_meeting_survives_without_current_target_and_never_exposes_record(
    setup, change
):
    admin, member, book, meeting, week = setup
    if change == "remove_week":
        week.soft_delete(admin)
    elif change == "finish_book":
        Book.objects.filter(pk=book.pk).update(status="terminado")
    else:
        ReadingAssignment.objects.filter(pk=week.pk).update(meeting=None)
        Meeting.objects.filter(pk=meeting.pk).update(book=None)
    result = home(browser(member))
    assert result["currentWeek"] is None and result["memberProgress"] == []
    assert result["nextMeeting"]["id"] == str(meeting.pk)
    assert (result["nextMeeting"]["assignment"] is None) == (change != "finish_book")
    assert (result["nextMeeting"]["book"] is None) == (change == "unlinked_meeting")
    assert set(result["nextMeeting"]) == {"id", "startsAt", "book", "assignment"}
    client = browser(member)
    assert (
        checked_get(client, "/api/members", "/api/members")["currentWeekNumber"] is None
    )
    assert (
        checked_get(client, f"/api/members/{member.pk}", "/api/members/{memberId}")[
            "currentWeek"
        ]
        is None
    )
