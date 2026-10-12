"""Real reading-plan HTTP, canonical reservations and retained independent facts."""

import json
from datetime import datetime, timezone

import pytest
from django.db import IntegrityError, transaction
from django.test import Client
from jsonschema import Draft202012Validator, FormatChecker

from books.models import Book
from config.contract import read_contract, resolve
from meetings.models import Meeting, ReadingAssignment
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
PATH = "/api/admin/books/{bookId}/reading-plan"
WEEKS = PATH + "/weeks"
ITEM = WEEKS + "/{weekId}"
ORDER = WEEKS + "/order"


@pytest.fixture
def setup():
    admin = User.objects.create_user(
        "100000000000000001",
        display_name="Fictional admin",
        role="admin",
        approved=True,
    )
    member = User.objects.create_user(
        "100000000000000002", display_name="Fictional member", approved=True
    )
    book = Book.objects.create(title="Fictional reading book", page_count=100)
    meeting = Meeting.objects.create(
        book=book,
        starts_at=datetime(2026, 1, 15, 19, tzinfo=timezone.utc),
        summary_text="PRIVATE SUMMARY SENTINEL",
    )
    return admin, member, book, meeting


def browser(identity=None):
    client = Client(enforce_csrf_checks=True)
    if identity:
        client.force_login(identity)
    client.get("/api/session")
    return client


def send(client, method, path, book, data=None, week=None, csrf=True):
    url = path.replace("{bookId}", str(book.pk)).replace(
        "{weekId}", str(week.pk) if week else "missing"
    )
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    return client.generic(
        method.upper(),
        url,
        data=json.dumps(data).encode() if data is not None else b"",
        content_type="application/json",
        **headers,
    )


def checked(response, method, path, status=200):
    assert response.status_code == status, response.content
    doc = read_contract()
    schema = resolve(doc, doc["paths"][path][method]["responses"][str(status)])[
        "content"
    ]["application/json"]["schema"]
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(
        response.json()
    )
    return response.json()


def data(acknowledged=False, **changes):
    return {
        "input": {
            "percentStart": 0,
            "percentEnd": 25,
            "pageStart": 1,
            "pageEnd": 25,
            "dueDate": "2026-01-10",
            "notes": "  manual fictional note  ",
            "meetingId": None,
            **changes,
        },
        "acknowledged": acknowledged,
    }


def create(client, book, **changes):
    plan = checked(
        send(client, "post", WEEKS, book, data(**changes)), "post", WEEKS, 201
    )
    return ReadingAssignment.objects.get(pk=plan["weeks"][-1]["id"])


def test_create_edit_reschedule_and_member_schedule_preserve_independent_facts(setup):
    admin, member, book, meeting = setup
    client = browser(admin)
    row = create(client, book, meetingId=str(meeting.pk))
    assert row.notes == "manual fictional note"
    before = (
        row.percent_start,
        row.percent_end,
        row.page_start,
        row.page_end,
        row.due_date,
        row.notes,
    )
    moved = client.put(
        f"/api/admin/meetings/{meeting.pk}",
        data=json.dumps(
            {
                "startsAt": "2026-02-01T18:30:00Z",
                "bookId": str(book.pk),
                "weekId": str(row.pk),
            }
        ),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    checked(moved, "put", "/api/admin/meetings/{meetingId}")
    row.refresh_from_db()
    assert (
        row.percent_start,
        row.percent_end,
        row.page_start,
        row.page_end,
        row.due_date,
        row.notes,
    ) == before
    plan = checked(send(client, "get", PATH, book), "get", PATH)
    assert plan["weeks"][0]["meetingId"] == str(meeting.pk)
    assert "SENTINEL" not in str(plan)
    member_view = checked(
        browser(member).get(f"/api/books/{book.pk}"), "get", "/api/books/{bookId}"
    )
    assert member_view["schedule"][0]["meeting"]["startsAt"] == "2026-02-01T18:30:00Z"
    assert member_view["schedule"][0]["notes"] == row.notes
    assert "SENTINEL" not in str(member_view)
    changed = checked(
        send(client, "put", ITEM, book, data(percentEnd=30, pageEnd=30), row),
        "put",
        ITEM,
    )
    assert changed["weeks"][0]["meetingId"] is None
    meeting.refresh_from_db()
    assert meeting.summary_text == "PRIVATE SUMMARY SENTINEL"


@pytest.mark.parametrize("identity,status", [(None, 401), (1, 403)])
def test_roles_refused_before_missing_subject_or_malformed_input(
    setup, identity, status
):
    client = browser(setup[identity] if identity is not None else None)
    missing = Book(pk=99999)
    for method, path in [
        ("get", PATH),
        ("post", WEEKS),
        ("put", ITEM),
        ("put", ORDER),
        ("delete", ITEM),
    ]:
        checked(send(client, method, path, missing, {}), method, path, status)


def test_csrf_and_revoked_admin_cannot_write(setup):
    admin, _, book, _ = setup
    client = browser(admin)
    checked(send(client, "post", WEEKS, book, data(), csrf=False), "post", WEEKS, 403)
    User.objects.filter(pk=admin.pk).update(
        approved=False, revoked_at=datetime.now(timezone.utc)
    )
    checked(send(client, "post", WEEKS, book, data()), "post", WEEKS, 401)
    assert ReadingAssignment.all_objects.count() == 0


@pytest.mark.parametrize(
    "changes",
    [
        {"percentEnd": 101.5},
        {"pageEnd": 101},
        {"pageStart": 30},
        {"percentStart": 30},
        {"percentEnd": 35.1},
    ],
)
def test_warnings_require_current_explicit_ack_without_partial_mutation(setup, changes):
    admin, _, book, _ = setup
    client = browser(admin)
    checked(send(client, "post", WEEKS, book, data(**changes)), "post", WEEKS, 400)
    assert ReadingAssignment.all_objects.count() == 0
    accepted = checked(
        send(client, "post", WEEKS, book, data(acknowledged=True, **changes)),
        "post",
        WEEKS,
        201,
    )
    assert accepted["weeks"][0][next(iter(changes))] == next(iter(changes.values()))
    checked(browser(admin).get(f"/api/books/{book.pk}"), "get", "/api/books/{bookId}")


@pytest.mark.parametrize(
    "changes",
    [
        {"percentEnd": True},
        {"percentEnd": float("nan")},
        {"pageEnd": 0},
        {"pageEnd": 2.5},
        {"dueDate": "2026-02-30"},
        {"notes": "x" * 1001},
        {"meetingId": 1},
        {"unexpected": 1},
    ],
)
def test_invalid_input_is_400_even_when_acknowledged(setup, changes):
    client = browser(setup[0])
    checked(
        send(client, "post", WEEKS, setup[2], data(acknowledged=True, **changes)),
        "post",
        WEEKS,
        400,
    )
    assert ReadingAssignment.all_objects.count() == 0


def test_reorder_requires_exact_permutation_and_rechecks_whole_plan(setup):
    admin, _, book, _ = setup
    client = browser(admin)
    first = create(client, book)
    second = create(
        client, book, percentStart=25, percentEnd=50, pageStart=26, pageEnd=50
    )
    ids = [str(second.pk), str(first.pk)]
    for invalid in [
        [str(first.pk)],
        [str(first.pk)] * 2,
        [str(first.pk), "99999"],
        [1, 2],
    ]:
        checked(
            send(client, "put", ORDER, book, {"ids": invalid, "acknowledged": True}),
            "put",
            ORDER,
            400,
        )
    checked(
        send(client, "put", ORDER, book, {"ids": ids, "acknowledged": False}),
        "put",
        ORDER,
        400,
    )
    assert list(
        ReadingAssignment.objects.order_by("week_number").values_list("pk", flat=True)
    ) == [first.pk, second.pk]
    plan = checked(
        send(client, "put", ORDER, book, {"ids": ids, "acknowledged": True}),
        "put",
        ORDER,
    )
    assert [(w["id"], w["weekNumber"]) for w in plan["weeks"]] == [
        (str(second.pk), 1),
        (str(first.pk), 2),
    ]


def test_removed_week_retains_reservation_calendar_metadata_and_facts(setup):
    admin, _, book, meeting = setup
    client = browser(admin)
    row = create(client, book, meetingId=str(meeting.pk))
    second = create(
        client, book, percentStart=25, percentEnd=50, pageStart=26, pageEnd=50
    )
    plan = checked(send(client, "delete", ITEM, book, week=row), "delete", ITEM)
    assert plan["weeks"][0]["weekNumber"] == 1 and plan["weeks"][0]["id"] == str(
        second.pk
    )
    row = ReadingAssignment.all_objects.get(pk=row.pk)
    assert row.meeting_id == meeting.pk and row.notes == "manual fictional note"
    checked(
        send(
            client,
            "post",
            WEEKS,
            book,
            data(acknowledged=True, meetingId=str(meeting.pk)),
        ),
        "post",
        WEEKS,
        409,
    )
    checked(
        send(
            client,
            "put",
            ORDER,
            book,
            {"ids": [str(row.pk), str(second.pk)], "acknowledged": True},
        ),
        "put",
        ORDER,
        404,
    )
    calendar = checked(client.get("/api/admin/meetings"), "get", "/api/admin/meetings")
    entries = calendar["upcoming"] + calendar["past"]
    assert entries[0]["removedWeekNumber"] == 1 and entries[0]["weekId"] == str(row.pk)
    assert [w["id"] for w in calendar["weeks"]] == [str(second.pk)]
    body = {
        "startsAt": "2026-02-01T18:00:00Z",
        "bookId": str(book.pk),
        "weekId": str(row.pk),
    }
    response = client.put(
        f"/api/admin/meetings/{meeting.pk}",
        json.dumps(body),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    checked(response, "put", "/api/admin/meetings/{meetingId}")
    body["weekId"] = None
    response = client.put(
        f"/api/admin/meetings/{meeting.pk}",
        json.dumps(body),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    checked(response, "put", "/api/admin/meetings/{meetingId}")
    row.refresh_from_db()
    assert row.meeting_id is None
    create(client, book, acknowledged=True, meetingId=str(meeting.pk))


def test_removed_meeting_association_survives_week_edit_until_released(setup):
    admin, _, book, meeting = setup
    client = browser(admin)
    row = create(client, book, meetingId=str(meeting.pk))
    meeting.soft_delete(admin)
    plan = checked(
        send(
            client,
            "put",
            ITEM,
            book,
            data(notes="edited", meetingId=str(meeting.pk)),
            row,
        ),
        "put",
        ITEM,
    )
    assert plan["weeks"][0]["removedMeeting"] is True
    assert plan["meetings"] == []
    checked(
        send(
            client,
            "post",
            WEEKS,
            book,
            data(acknowledged=True, meetingId=str(meeting.pk)),
        ),
        "post",
        WEEKS,
        404,
    )
    view = checked(
        browser(setup[1]).get(f"/api/books/{book.pk}"), "get", "/api/books/{bookId}"
    )
    assert view["schedule"][0]["meeting"] is None
    checked(send(client, "put", ITEM, book, data(notes="edited"), row), "put", ITEM)
    row.refresh_from_db()
    assert row.meeting_id is None


def test_wrong_book_missing_and_occupied_links_are_rejected(setup):
    admin, _, book, meeting = setup
    client = browser(admin)
    other = Book.objects.create(title="Fictional other book")
    checked(
        send(client, "post", WEEKS, other, data(meetingId=str(meeting.pk))),
        "post",
        WEEKS,
        400,
    )
    checked(
        send(client, "post", WEEKS, book, data(meetingId="99999")), "post", WEEKS, 404
    )
    row = create(client, book, meetingId=str(meeting.pk))
    checked(
        send(
            client,
            "post",
            WEEKS,
            book,
            data(acknowledged=True, meetingId=str(meeting.pk)),
        ),
        "post",
        WEEKS,
        409,
    )
    target = Meeting.objects.create(book=book, starts_at=meeting.starts_at)
    body = {
        "startsAt": "2026-02-01T18:00:00Z",
        "bookId": str(book.pk),
        "weekId": str(row.pk),
    }
    response = client.put(
        f"/api/admin/meetings/{target.pk}",
        json.dumps(body),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    checked(response, "put", "/api/admin/meetings/{meetingId}", 409)
    target.refresh_from_db()
    assert target.starts_at == meeting.starts_at


def test_failed_projection_rolls_back_week_remove_and_renumber(setup, monkeypatch):
    admin, _, book, _ = setup
    client = browser(admin)
    row = create(client, book)
    second = create(
        client, book, percentStart=25, percentEnd=50, pageStart=26, pageEnd=50
    )

    def failed(_book):
        raise RuntimeError("PRIVATE STORAGE ERROR")

    monkeypatch.setattr("meetings.reading_plan.projection", failed)
    response = send(client, "delete", ITEM, book, week=row)
    checked(response, "delete", ITEM, 500)
    assert b"PRIVATE" not in response.content
    row.refresh_from_db()
    second.refresh_from_db()
    assert row.deleted_at is None and second.week_number == 2


def test_sql_enforces_positive_finite_facts_active_order_and_retained_reservation(
    setup,
):
    admin, _, book, meeting = setup
    row = create(browser(admin), book, meetingId=str(meeting.pk))
    for invalid in [
        {"page_start": 0},
        {"percent_end": float("inf")},
        {"percent_start": -1},
        {"week_number": 0},
    ]:
        with pytest.raises(IntegrityError), transaction.atomic():
            ReadingAssignment.all_objects.filter(pk=row.pk).update(**invalid)
    with pytest.raises(IntegrityError), transaction.atomic():
        ReadingAssignment.objects.create(
            book=book,
            week_number=1,
            percent_start=0,
            percent_end=25,
            page_start=1,
            page_end=25,
        )
    row.soft_delete(admin)
    with pytest.raises(IntegrityError), transaction.atomic():
        ReadingAssignment.objects.create(
            book=book,
            meeting=meeting,
            week_number=1,
            percent_start=0,
            percent_end=25,
            page_start=1,
            page_end=25,
        )
