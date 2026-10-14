"""Authenticated statistics exposure, using fictional native database rows."""

from datetime import datetime, timezone

import pytest
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from jsonschema import Draft202012Validator

from books.models import Book, BookCompletion
from config.contract import read_contract, resolve
from meetings.models import Meeting
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


def get(client, status=200, path=PATH):
    response = client.get(path)
    assert response.status_code == status, response.content
    schema = resolve(DOC, DOC["paths"][path]["get"]["responses"][str(status)])[
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


@pytest.mark.parametrize("actor_index", [0, 1, 2])
@pytest.mark.parametrize(
    "finished,submitted", [(False, False), (True, False), (False, True), (True, True)]
)
def test_statistics_gate_precedes_every_rating_figure(
    world, actor_index, finished, submitted
):
    users, books = world
    actor = users[actor_index]
    other = next(member for member in users if member != actor)
    rate(books[3], other, 1)
    if submitted:
        rate(books[3], actor, 5)
    if finished:
        unlock(books[3], actor)
    with CaptureQueriesContext(connection) as captured:
        result = get(browser(actor), path="/api/statistics")
    assert result["booksRead"] == 4 and result["meetingsHeld"] == 0
    assert result["thresholds"] == {"bookRatings": 3, "memberRatings": 3}
    if finished and submitted:
        assert result["ratings"]["reviewCount"] == 2
        assert result["ratings"]["overallMean"] == 3
        assert result["ratings"]["bookCount"] == 1
    else:
        assert result["ratings"] == {"status": "empty"}
        assert "SECRET_BOOK" not in str(result)
        assert not any(
            '"reviews_review"."disfrute"' in q["sql"] for q in captured.captured_queries
        )
    assert "SECRET_REVIEW_TEXT" not in str(result)


def test_statistics_counts_use_retained_books_and_strict_past_meetings(
    world, monkeypatch
):
    from datetime import timedelta

    from django.utils import timezone as django_timezone

    monkeypatch.setattr(django_timezone, "now", lambda: NOW)
    users, books = world
    books[0].status = "archivado"
    books[0].save(update_fields=["status"])
    books[1].status = "leyendo"
    books[1].save(update_fields=["status"])
    past = NOW - timedelta(seconds=1)
    for starts, cancelled in [
        (past, False),
        (past, True),
        (NOW, False),
        (NOW + timedelta(seconds=1), False),
    ]:
        Meeting.objects.create(starts_at=starts, cancelled=cancelled)
    removed = Meeting.objects.create(starts_at=past)
    removed.soft_delete(users[0])
    Meeting.objects.create(starts_at=past, book=books[3])
    books[3].soft_delete(users[0])
    result = get(browser(users[0]), path="/api/statistics")
    assert result == {
        "booksRead": 2,
        "meetingsHeld": 1,
        "thresholds": {"bookRatings": 3, "memberRatings": 3},
        "ratings": {"status": "empty"},
    }


def test_statistics_weight_each_visible_review_and_retain_revoked_attribution(world):
    users, books = world
    client = browser(users[0])
    for book in books[:2]:
        unlock(book, users[0])
        rate(book, users[0], 5)
    rate(books[0], users[1], 2)
    rate(books[0], users[2], 1)
    rate(books[3], users[1], 1)
    User.objects.filter(pk=users[1].pk).update(approved=False, revoked_at=NOW)
    ratings = get(client, path="/api/statistics")["ratings"]
    assert ratings["overallMean"] == 3.25
    assert ratings["reviewCount"] == 4 and ratings["bookCount"] == 2
    assert ratings["criterionMeans"] == dict.fromkeys(CRITERIA, 3.25)
    assert ratings["members"][0]["isMe"] is True
    assert ratings["members"][0]["reviewCount"] == 2
    assert ratings["members"][0]["overallMean"] == 5
    assert any(row["member"]["id"] == str(users[1].pk) for row in ratings["members"])
    assert "SECRET_BOOK" not in str(ratings)
    Review.objects.filter(book=books[0], member=users[1]).update(
        **dict.fromkeys(CRITERIA, 4)
    )
    assert get(client, path="/api/statistics")["ratings"]["overallMean"] == 3.75
    books[0].soft_delete(users[0])
    ratings = get(client, path="/api/statistics")["ratings"]
    assert ratings["reviewCount"] == ratings["bookCount"] == 1
    assert ratings["overallMean"] == 5
    assert str(users[1].pk) not in [row["member"]["id"] for row in ratings["members"]]
    books[0].restore(users[0])
    assert get(client, path="/api/statistics")["ratings"]["reviewCount"] == 4


@pytest.mark.parametrize("kind", ["anonymous", "pending", "revoked"])
def test_statistics_rechecks_membership(world, kind):
    users, _ = world
    actor = users[0] if kind != "anonymous" else None
    client = browser(actor)
    if kind != "anonymous":
        User.objects.filter(pk=actor.pk).update(
            approved=False, revoked_at=NOW if kind == "revoked" else None
        )
    assert get(client, 401, path="/api/statistics")["code"] == "unauthenticated"


def test_statistics_empty_is_identical_with_no_reviews_or_only_locked_reviews(world):
    users, books = world
    client = browser(users[0])
    expected = get(client, path="/api/statistics")
    for book in books:
        rate(book, users[1], 1)
    assert get(client, path="/api/statistics") == expected
    assert (
        client.get("/api/statistics", {"viewerId": str(users[1].pk)}).json() == expected
    )


@pytest.mark.parametrize("actor_index", [0, 1, 2])
@pytest.mark.parametrize(
    "finished,submitted", [(False, False), (True, False), (False, True), (True, True)]
)
def test_home_review_count_requires_both_flags_for_every_role_without_loading_scores(
    world, actor_index, finished, submitted
):
    users, books = world
    actor = users[actor_index]
    other = next(member for member in users if member != actor)
    rate(books[3], other, 1)
    if submitted:
        rate(books[3], actor, 5)
    if finished:
        unlock(books[3], actor)
    with CaptureQueriesContext(connection) as captured:
        result = get(browser(actor), path="/api/home")
    assert result["stats"] == {
        "booksCompleted": 4,
        "members": 4,
        "reviews": 2 if finished and submitted else 0,
    }
    assert "SECRET_BOOK" not in str(result) and "SECRET_REVIEW_TEXT" not in str(result)
    assert not any(
        '"reviews_review"."disfrute"' in q["sql"] for q in captured.captured_queries
    )


def test_home_counts_match_permitted_statistics_reviews_with_history_and_removal(world):
    users, books = world
    client = browser(users[0])
    books[0].status = "archivado"
    books[0].save(update_fields=["status"])
    for book in books[:2]:
        unlock(book, users[0])
        rate(book, users[0], 5)
        rate(book, users[1], 2)
    rate(books[3], users[2], 1)
    unlock(books[3], users[0])  # Finished without an own review never counts.
    User.objects.filter(pk=users[1].pk).update(approved=False, revoked_at=NOW)
    assert get(client, path="/api/home")["stats"] == {
        "booksCompleted": 3,
        "members": 3,
        "reviews": 4,
    }
    assert get(client, path="/api/statistics")["ratings"]["reviewCount"] == 4
    # Editing scores affects means, not the visible review denominator.
    Review.objects.filter(book=books[0], member=users[1]).update(
        **dict.fromkeys(CRITERIA, 5)
    )
    assert get(client, path="/api/home")["stats"]["reviews"] == 4
    books[1].soft_delete(users[0])
    assert get(client, path="/api/home")["stats"] == {
        "booksCompleted": 2,
        "members": 3,
        "reviews": 2,
    }
    books[1].restore(users[0])
    assert get(client, path="/api/home")["stats"]["reviews"] == 4
    BookCompletion.objects.filter(book=books[0], member=users[0]).update(
        completed_at=None
    )
    assert get(client, path="/api/home")["stats"]["reviews"] == 2
    User.objects.filter(pk=users[1].pk).update(approved=True, revoked_at=None)
    assert get(client, path="/api/home")["stats"]["members"] == 4
