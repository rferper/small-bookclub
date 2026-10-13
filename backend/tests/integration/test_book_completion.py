"""Native personal completion: ownership, retention and independent flags."""

import json
from datetime import datetime, timedelta, timezone

import pytest
from django.db import IntegrityError, transaction
from django.test import Client
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator, FormatChecker

from books.models import Book, BookCompletion
from config.contract import read_contract, resolve
from meetings.models import ReadingAssignment, ReadingCompletion
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
PATH = "/api/books/{bookId}/finished"
READ = "/api/books/{bookId}/ratings"
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
    book = Book.objects.create(title="Fictional personal finish", status="leyendo")
    week = ReadingAssignment.objects.create(
        book=book,
        week_number=1,
        percent_start=0,
        percent_end=100,
        page_start=1,
        page_end=100,
    )
    return identities, book, week


def browser(identity=None):
    client = Client(enforce_csrf_checks=True)
    if identity:
        client.force_login(identity)
    client.get("/api/session")
    return client


def put(client, book, value, csrf=True):
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    return client.put(
        PATH.replace("{bookId}", str(book.pk)),
        json.dumps(value),
        content_type="application/json",
        **headers,
    )


def checked(response, status=200, path=PATH, method="put"):
    assert response.status_code == status, response.content
    doc = read_contract()
    schema = resolve(doc, doc["paths"][path][method]["responses"][str(status)])[
        "content"
    ]["application/json"]["schema"]
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(
        response.json()
    )
    return response.json()


@pytest.mark.parametrize("index", [0, 1, 2])
def test_personal_and_weekly_completion_are_independent_for_every_role(
    setup, index, monkeypatch
):
    identities, book, week = setup
    actor, other = identities[index], identities[(index + 1) % 3]
    client = browser(actor)
    BookCompletion.objects.create(book=book, member=other, completed_at=NOW)
    ReadingCompletion.objects.create(assignment=week, member=actor, completed_at=NOW)
    view = checked(
        client.get(READ.replace("{bookId}", str(book.pk))), path=READ, method="get"
    )
    assert view["finishedByMe"] is False
    result = checked(put(client, book, {"finished": True}))
    assert result["finishedByMe"] is True
    assert result["myReview"] is None
    assert result["club"] == {"status": "locked"}
    row = BookCompletion.objects.get(book=book, member=actor)
    assert row.completed_at == NOW
    monkeypatch.setattr(django_timezone, "now", lambda: NOW + timedelta(days=365))
    client = browser(actor)
    checked(put(client, book, {"finished": True}))
    row.refresh_from_db()
    assert row.completed_at == NOW
    assert checked(put(client, book, {"finished": False}))["finishedByMe"] is False
    checked(put(client, book, {"finished": False}))
    row.refresh_from_db()
    assert row.completed_at is None
    assert BookCompletion.objects.get(member=other).completed_at == NOW
    assert ReadingCompletion.objects.get(member=actor).completed_at == NOW
    ReadingCompletion.objects.filter(member=actor).update(completed_at=None)
    checked(put(client, book, {"finished": True}))
    assert ReadingCompletion.objects.get(member=actor).completed_at is None
    book.refresh_from_db()
    assert book.status == "leyendo"


@pytest.mark.parametrize(
    "status,ratable",
    [
        ("propuesto", False),
        ("elegido", False),
        ("leyendo", True),
        ("terminado", True),
        ("archivado", True),
    ],
)
def test_ratable_lifecycle_is_server_owned_and_clear_is_allowed(setup, status, ratable):
    identities, book, _ = setup
    Book.objects.filter(pk=book.pk).update(status=status)
    client = browser(identities[1])
    view = checked(
        client.get(READ.replace("{bookId}", str(book.pk))), path=READ, method="get"
    )
    assert view["ratable"] is ratable
    checked(put(client, book, {"finished": True}), 200 if ratable else 409)
    checked(put(client, book, {"finished": False}))
    assert BookCompletion.objects.get(member=identities[1]).completed_at is None


@pytest.mark.parametrize(
    "key", ["id", "userId", "memberId", "ownerId", "user", "owner", "member", "USERID"]
)
@pytest.mark.parametrize("same", [True, False])
def test_ownership_injection_is_forbidden_before_lookup(setup, key, same):
    identities, book, _ = setup
    actor = identities[1]
    value = {"finished": True, key: str(actor.pk if same else identities[2].pk)}
    client = browser(actor)
    checked(put(client, book, value), 403)
    checked(put(client, Book(pk=99999), value), 403)
    assert not BookCompletion.objects.exists()


@pytest.mark.parametrize(
    "value",
    [
        {},
        {"finished": 1},
        {"finished": "true"},
        {"finished": None},
        {"finished": False, "extra": True},
        [],
        True,
    ],
)
def test_invalid_payload_and_missing_removed_book_precedence(setup, value):
    identities, book, _ = setup
    client = browser(identities[1])
    checked(put(client, book, value), 400)
    checked(put(client, Book(pk=99999), value), 404)
    book.soft_delete(identities[0])
    checked(put(client, book, value), 404)
    checked(client.get(READ.replace("{bookId}", str(book.pk))), 404, READ, "get")
    assert not BookCompletion.objects.exists()


def test_membership_csrf_and_approval_recheck_before_mutation(setup, monkeypatch):
    identities, book, _ = setup
    checked(put(browser(), Book(pk=99999), {}), 401)
    checked(browser().get(READ.replace("{bookId}", str(book.pk))), 401, READ, "get")
    client = browser(identities[1])
    checked(put(client, book, {"finished": True}, csrf=False), 403)
    from books import completion

    original = completion.permission_refusal

    def revoke_at_recheck(actor, *args, **kwargs):
        User.objects.filter(pk=actor.pk).update(approved=False, revoked_at=NOW)
        actor.refresh_from_db()
        return original(actor, *args, **kwargs)

    monkeypatch.setattr(completion, "permission_refusal", revoke_at_recheck)
    checked(put(client, book, {"finished": True}), 401)
    assert not BookCompletion.objects.exists()


def test_unique_pair_retention_and_atomic_safe_failure(setup, monkeypatch):
    identities, book, _ = setup
    row = BookCompletion.objects.create(
        book=book, member=identities[1], completed_at=NOW
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        BookCompletion.objects.create(book=book, member=identities[1])
    book.soft_delete(identities[0])
    assert book.completions.get().completed_at == NOW
    book.restore(identities[0])

    def failed(*args, **kwargs):
        raise RuntimeError("PRIVATE ERROR SENTINEL")

    monkeypatch.setattr(BookCompletion, "save", failed)
    response = put(browser(identities[1]), book, {"finished": False})
    checked(response, 500)
    assert b"SENTINEL" not in response.content
    row.refresh_from_db()
    assert row.completed_at == NOW
