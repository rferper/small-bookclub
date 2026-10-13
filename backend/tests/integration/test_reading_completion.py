"""Real session-owned completion, retained history and schedule/count adoption."""

import json
from datetime import datetime, timedelta, timezone

import pytest
from django.db import IntegrityError, transaction
from django.test import Client
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator, FormatChecker

from books.models import Book
from config.contract import read_contract, resolve
from meetings.models import ReadingAssignment, ReadingCompletion
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
PATH = "/api/weeks/{weekId}/completion"
NOW = datetime(2026, 1, 15, 19, tzinfo=timezone.utc)


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setattr(django_timezone, "now", lambda: NOW)
    identities = [
        User.objects.create_user(
            f"1000000000000000{index:02d}",
            display_name=f"Fictional reader {index}",
            approved=True,
            role="admin" if index == 1 else "member",
        )
        for index in [1, 2, 3]
    ]
    book = Book.objects.create(title="Fictional completed book", status="terminado")
    week = ReadingAssignment.objects.create(
        book=book,
        week_number=1,
        percent_start=10.5,
        percent_end=25,
        page_start=20,
        page_end=50,
        due_date="2020-01-01",
    )
    return identities, book, week


def browser(identity=None):
    client = Client(enforce_csrf_checks=True)
    if identity:
        client.force_login(identity)
    client.get("/api/session")
    return client


def put(client, week, value, csrf=True):
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    return client.put(
        PATH.replace("{weekId}", str(week.pk)),
        json.dumps(value),
        content_type="application/json",
        **headers,
    )


def checked(response, status=204, path=PATH, method="put"):
    assert response.status_code == status, response.content
    if status == 204:
        assert response.content == b""
        return None
    doc = read_contract()
    schema = resolve(doc, doc["paths"][path][method]["responses"][str(status)])[
        "content"
    ]["application/json"]["schema"]
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(
        response.json()
    )
    return response.json()


@pytest.mark.parametrize("index", [0, 1, 2])
def test_every_approved_role_can_only_change_own_week_idempotently(
    setup, index, monkeypatch
):
    identities, book, week = setup
    client = browser(identities[index])
    other = identities[(index + 1) % 3]
    ReadingCompletion.objects.create(
        assignment=week, member=other, completed_at=NOW - timedelta(days=1)
    )
    checked(put(client, week, {"completed": True}))
    row = ReadingCompletion.objects.get(assignment=week, member=identities[index])
    assert row.completed_at == NOW
    monkeypatch.setattr(django_timezone, "now", lambda: NOW + timedelta(days=365))
    client = browser(identities[index])
    checked(put(client, week, {"completed": True}))
    row.refresh_from_db()
    assert row.completed_at == NOW
    view = checked(
        client.get(f"/api/books/{book.pk}"), 200, "/api/books/{bookId}", "get"
    )
    assert view["schedule"][0]["completedByMe"] is True
    checked(put(client, week, {"completed": False}))
    checked(put(client, week, {"completed": False}))
    row.refresh_from_db()
    assert row.completed_at is None
    other_row = ReadingCompletion.objects.get(assignment=week, member=other)
    assert other_row.completed_at == NOW - timedelta(days=1)
    assert ReadingCompletion.objects.count() == 2
    view = checked(
        client.get(f"/api/books/{book.pk}"), 200, "/api/books/{bookId}", "get"
    )
    assert view["schedule"][0]["completedByMe"] is False
    book.refresh_from_db()
    assert book.status == "terminado"
    assert not hasattr(book, "personally_finished")


@pytest.mark.parametrize(
    "key", ["id", "userId", "memberId", "ownerId", "user", "owner", "member", "USERID"]
)
@pytest.mark.parametrize("owner", ["same", "other"])
def test_ownership_injection_is_forbidden_even_for_same_member_before_lookup(
    setup, key, owner
):
    identities, _, week = setup
    actor = identities[1]
    client = browser(actor)
    supplied = str(actor.pk if owner == "same" else identities[2].pk)
    checked(put(client, week, {"completed": True, key: supplied}), 403)
    checked(put(client, ReadingAssignment(pk=99999), {key: supplied}), 403)
    assert ReadingCompletion.objects.count() == 0


@pytest.mark.parametrize(
    "value",
    [
        {},
        {"completed": 1},
        {"completed": "true"},
        {"completed": None},
        {"completed": False, "extra": True},
        [],
        True,
    ],
)
def test_invalid_payload_is_rejected_without_completion_change(setup, value):
    identities, _, week = setup
    checked(put(browser(identities[1]), week, value), 400)
    assert ReadingCompletion.objects.count() == 0


def test_removed_week_parent_and_missing_ids_are_404_before_ordinary_input(setup):
    identities, book, week = setup
    client = browser(identities[1])
    checked(put(client, week, {"completed": True}))
    week.soft_delete(identities[0])
    checked(put(client, week, {}), 404)
    checked(put(client, ReadingAssignment(pk=99999), {}), 404)
    assert ReadingCompletion.objects.get(assignment=week).completed_at == NOW
    week.restore(identities[0])
    book.soft_delete(identities[0])
    checked(put(client, week, {"completed": False}), 404)
    assert ReadingCompletion.objects.get(assignment=week).completed_at == NOW


def test_anonymous_revoked_and_csrf_refused_before_write(setup):
    identities, _, week = setup
    checked(put(browser(), ReadingAssignment(pk=99999), {}), 401)
    client = browser(identities[1])
    checked(put(client, week, {"completed": True}, csrf=False), 403)
    User.objects.filter(pk=identities[1].pk).update(approved=False, revoked_at=NOW)
    checked(put(client, week, {"completed": True}), 401)
    assert ReadingCompletion.objects.count() == 0


def test_counts_include_retained_revoked_completions_and_no_date_automation(
    setup, monkeypatch
):
    identities, book, week = setup
    checked(put(browser(identities[1]), week, {"completed": True}))
    checked(put(browser(identities[2]), week, {"completed": False}))
    User.objects.filter(pk=identities[1].pk).update(approved=False, revoked_at=NOW)
    monkeypatch.setattr(django_timezone, "now", lambda: NOW + timedelta(days=365))
    client = browser(identities[0])
    plan = checked(
        client.get(f"/api/admin/books/{book.pk}/reading-plan"),
        200,
        "/api/admin/books/{bookId}/reading-plan",
        "get",
    )
    assert plan["weeks"][0]["completionCount"] == 1
    view = checked(
        client.get(f"/api/books/{book.pk}"), 200, "/api/books/{bookId}", "get"
    )
    assert view["schedule"][0]["completedByMe"] is False
    assert ReadingCompletion.objects.get(member=identities[1]).completed_at == NOW
    assert ReadingCompletion.objects.get(member=identities[2]).completed_at is None
    week.soft_delete(identities[0])
    week.refresh_from_db()
    assert week.completions.count() == 2


def test_sql_unique_pair_and_failed_completion_save_rolls_back(setup, monkeypatch):
    identities, _, week = setup
    row = ReadingCompletion.objects.create(
        assignment=week, member=identities[1], completed_at=NOW
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        ReadingCompletion.objects.create(assignment=week, member=identities[1])

    def failed(*args, **kwargs):
        raise RuntimeError("PRIVATE ERROR SENTINEL")

    monkeypatch.setattr(ReadingCompletion, "save", failed)
    response = put(browser(identities[1]), week, {"completed": False})
    checked(response, 500)
    assert b"SENTINEL" not in response.content
    row.refresh_from_db()
    assert row.completed_at == NOW
