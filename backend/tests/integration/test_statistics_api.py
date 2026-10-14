"""Authenticated statistics exposure, using fictional native database rows."""

from datetime import datetime, timezone

import pytest
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from jsonschema import Draft202012Validator

from books.models import Book, BookCompletion
from config.contract import read_contract, resolve
from reviews.constants import CRITERIA
from reviews.models import Review
from users.models import CuratorAssignment, User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
PATH = "/api/statistics/compatibility"
DOC = read_contract()


@pytest.fixture
def world():
    users = [
        User.objects.create_user(
            f"5100000000000000{i:02d}",
            approved=True,
            role="admin" if i == 0 else "member",
            display_name=name,
        )
        for i, name in enumerate(["Viewer", "Óscar", "Élida", "Nuria"])
    ]
    CuratorAssignment.objects.create(member=users[2])
    books = [
        Book.objects.create(
            title=title, authors=["Fictional author"], status="terminado"
        )
        for title in [
            "Zafiro ficticio",
            "Ángeles ficticios",
            "Nubes ficticias",
            "SECRET_BOOK",
        ]
    ]
    return users, books


def browser(actor):
    client = Client()
    if actor is not None:
        client.force_login(actor)
    return client


def get(client, status=200):
    response = client.get(PATH)
    assert response.status_code == status, response.content
    schema = resolve(DOC, DOC["paths"][PATH]["get"]["responses"][str(status)])[
        "content"
    ]["application/json"]["schema"]
    Draft202012Validator(schema).validate(response.json())
    return response.json()


def rate(book, member, value=4):
    return Review.objects.create(
        book=book,
        member=member,
        text="SECRET_REVIEW_TEXT",
        **dict.fromkeys(CRITERIA, value),
    )


def unlock(book, member):
    BookCompletion.objects.update_or_create(
        book=book, member=member, defaults={"completed_at": NOW}
    )


def entry(result, member):
    return next(
        row for row in result["members"] if row["member"]["id"] == str(member.pk)
    )


@pytest.mark.parametrize("actor_index", [0, 1, 2])
@pytest.mark.parametrize(
    "finished,submitted", [(False, False), (True, False), (False, True), (True, True)]
)
def test_every_role_needs_both_personal_flags_before_shared_counts(
    world, actor_index, finished, submitted
):
    users, books = world
    actor = users[actor_index]
    other = next(member for member in users if member != actor)
    for book in books:
        rate(book, other, 1)
        if submitted:
            rate(book, actor, 5)
        if finished:
            unlock(book, actor)
    with CaptureQueriesContext(connection) as captured:
        result = get(browser(actor))
    target = entry(result, other)
    if finished and submitted:
        assert target["sharedBookCount"] == 4
        assert target["comparison"]["overallDifference"] == 4
    else:
        assert target["sharedBookCount"] == 0
        assert target["comparison"] == {"status": "insufficient"}
        assert "SECRET_BOOK" not in str(result)
        # No foreign-score select occurs until the central gate allows a book.
        assert not any(
            '"reviews_review"."disfrute"' in q["sql"] for q in captured.captured_queries
        )
    assert "SECRET_REVIEW_TEXT" not in str(result)


@pytest.mark.parametrize("count", [0, 1, 2, 3])
def test_threshold_count_order_and_no_other_member_rating_count(world, count):
    users, books = world
    for book in books[:count]:
        unlock(book, users[0])
        rate(book, users[0], 5)
        rate(book, users[1], 2)
    # A foreign-only book cannot contribute to count or metadata.
    rate(books[3], users[1], 1)
    result = get(browser(users[0]))
    assert [row["member"]["displayName"] for row in result["members"]] == [
        "Élida",
        "Nuria",
        "Óscar",
    ]
    assert entry(result, users[2])["sharedBookCount"] == 0
    target = entry(result, users[1])
    assert target["sharedBookCount"] == count
    if count < 3:
        assert target["comparison"] == {"status": "insufficient"}
        assert all(book.title not in str(result) for book in books)
    else:
        assert target["comparison"]["overallDifference"] == 3
        assert [row["book"]["title"] for row in target["comparison"]["books"]] == [
            "Ángeles ficticios",
            "Nubes ficticias",
            "Zafiro ficticio",
        ]
    assert "SECRET_BOOK" not in str(result)


def test_edits_deletion_restoration_and_revocation_recompute_on_each_call(world):
    users, books = world
    client = browser(users[0])
    for book in books[:3]:
        unlock(book, users[0])
        rate(book, users[0], 5)
        rate(book, users[1], 2)
    assert entry(get(client), users[1])["comparison"]["overallDifference"] == 3
    Review.objects.filter(book=books[0], member=users[1]).update(
        **dict.fromkeys(CRITERIA, 5)
    )
    assert entry(get(client), users[1])["comparison"]["overallDifference"] == 2
    books[0].soft_delete(users[0])
    target = entry(get(client), users[1])
    assert target["sharedBookCount"] == 2 and target["comparison"] == {
        "status": "insufficient"
    }
    books[0].restore(users[0])
    assert entry(get(client), users[1])["comparison"]["overallDifference"] == 2
    User.objects.filter(pk=users[1].pk).update(approved=False, revoked_at=NOW)
    assert str(users[1].pk) not in [
        row["member"]["id"] for row in get(client)["members"]
    ]
    assert Review.objects.filter(member=users[1]).count() == 3
    User.objects.filter(pk=users[1].pk).update(approved=True, revoked_at=None)
    assert entry(get(client), users[1])["sharedBookCount"] == 3
    # Independent persisted completion facts are always rechecked.
    BookCompletion.objects.filter(book=books[0], member=users[0]).update(
        completed_at=None
    )
    assert entry(get(client), users[1])["sharedBookCount"] == 2


@pytest.mark.parametrize("kind", ["anonymous", "pending", "revoked"])
def test_ineligible_identity_receives_no_statistics(world, kind):
    users, _ = world
    actor = users[0] if kind != "anonymous" else None
    client = browser(actor)
    if kind != "anonymous":
        User.objects.filter(pk=actor.pk).update(
            approved=False, revoked_at=NOW if kind == "revoked" else None
        )
    assert get(client, 401)["code"] == "unauthenticated"


def test_request_cannot_select_another_viewer(world):
    users, books = world
    for book in books[:3]:
        unlock(book, users[0])
        rate(book, users[0], 5)
        rate(book, users[1], 1)
    client = browser(users[2])
    expected = get(client)
    response = client.get(
        PATH, {"viewerId": str(users[0].pk), "memberId": str(users[0].pk)}
    )
    assert response.status_code == 200 and response.json() == expected
