"""Session-owned review projection without foreign ratings or completion coupling."""

from datetime import datetime, timedelta, timezone

import pytest
from django.test import Client
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator

from books.models import Book, BookCompletion
from config.contract import read_contract, resolve
from reviews.constants import CRITERIA
from reviews.models import Review
from users.models import CuratorAssignment, User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
DOC = read_contract()


@pytest.fixture
def world(monkeypatch):
    monkeypatch.setattr(django_timezone, "now", lambda: NOW)
    users = [
        User.objects.create_user(
            f"8500000000000000{i:02d}",
            approved=i < 3,
            role="admin" if i == 0 else "member",
            display_name=f"Fictional reader {i}",
            revoked_at=NOW if i == 3 else None,
        )
        for i in range(5)
    ]
    CuratorAssignment.objects.create(member=users[2], assigned_at=NOW)
    book = Book.objects.create(title="Fictional own-review book", status="archivado")
    for i, user in enumerate(users[:3]):
        Review.objects.create(
            book=book,
            member=user,
            text=f"OWN_REVIEW_{i}",
            **dict(zip(CRITERIA, [5, 4.5, 3, 4, 2.5], strict=True)),
        )
    foreign = Book.objects.create(title="FOREIGN_ONLY_BOOK", status="terminado")
    Review.objects.create(
        book=foreign,
        member=users[0],
        text="FOREIGN_PRIVATE_TEXT",
        **dict.fromkeys(CRITERIA, 1),
    )
    return users, book, foreign


def browser(actor=None):
    client = Client()
    if actor:
        client.force_login(actor)
    return client


def read(client, status=200, query=""):
    response = client.get("/api/me/reviews" + query)
    assert response.status_code == status, response.content
    schema = resolve(
        DOC, DOC["paths"]["/api/me/reviews"]["get"]["responses"][str(status)]
    )["content"]["application/json"]["schema"]
    Draft202012Validator(schema).validate(response.json())
    return response.json()


@pytest.mark.parametrize("identity", [None, 3, 4])
def test_anonymous_revoked_pending_cannot_read_reviews(world, identity):
    users, *_ = world
    body = read(browser(users[identity] if identity is not None else None), 401)
    assert "OWN_REVIEW" not in str(body) and "FOREIGN" not in str(body)


@pytest.mark.parametrize("viewer", [0, 1, 2])
def test_member_admin_curator_get_only_their_own_reviews_without_completion(
    world, viewer
):
    users, book, foreign = world
    client = browser(users[viewer])
    rows = read(client)
    own = next(row for row in rows if row["book"]["id"] == str(book.pk))
    assert own["text"] == f"OWN_REVIEW_{viewer}" and own["overall"] == 3.8
    assert own["scores"] == dict(zip(CRITERIA, [5, 4.5, 3, 4, 2.5], strict=True))
    assert not BookCompletion.objects.filter(book=book, member=users[viewer]).exists()
    for other in range(3):
        if other != viewer:
            assert f"OWN_REVIEW_{other}" not in str(rows)
    if viewer != 0:
        assert "FOREIGN" not in str(rows)
    other_id = users[(viewer + 1) % 3].pk
    assert (
        read(
            client,
            query=f"?memberId={other_id}&userId={other_id}",
        )
        == rows
    )
    assert all(
        set(row) == {"book", "scores", "overall", "text", "submittedAt", "editedAt"}
        for row in rows
    )
    assert all(
        set(row["book"]) == {"id", "title", "authors", "coverUrl"} for row in rows
    )


def test_undoing_personal_completion_keeps_own_review_and_removed_book_is_hidden(world):
    users, book, _ = world
    client = browser(users[1])
    completion = BookCompletion.objects.create(
        book=book, member=users[1], completed_at=NOW
    )
    before = read(client)
    completion.completed_at = None
    completion.save(update_fields=["completed_at"])
    assert read(client) == before
    book.soft_delete(users[0])
    assert read(client) == []
    book.restore(users[0])
    assert read(client) == before


def test_empty_own_list_never_exposes_existing_foreign_reviews(world):
    users, *_ = world
    Review.objects.filter(member=users[1]).delete()
    assert Review.objects.exists()
    assert read(browser(users[1])) == []


def test_order_is_latest_edit_or_submission_then_spanish_title_and_native_id(world):
    users, book, _ = world
    Review.objects.filter(member=users[1]).delete()
    added = []
    for title in ["Zeta", "Ñube", "Árbol", "Zeta"]:
        parent = Book.objects.create(title=title, status="terminado")
        added.append(
            Review.objects.create(
                book=parent, member=users[1], **dict.fromkeys(CRITERIA, 4)
            )
        )
    rows = read(browser(users[1]))
    assert [row["book"]["title"] for row in rows] == ["Árbol", "Ñube", "Zeta", "Zeta"]
    assert [int(row["book"]["id"]) for row in rows[-2:]] == sorted(
        row.book_id for row in [added[0], added[3]]
    )
    Review.objects.filter(pk=added[0].pk).update(edited_at=NOW + timedelta(seconds=1))
    assert read(browser(users[1]))[0]["book"]["id"] == str(added[0].book_id)


def test_current_membership_is_rechecked_before_review_lookup(world):
    users, *_ = world
    client = browser(users[1])
    User.objects.filter(pk=users[1].pk).update(approved=False, revoked_at=NOW)
    assert read(client, 401)["code"] == "unauthenticated"


def test_projection_failure_returns_safe_error(world, monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("FOREIGN_PRIVATE_TEXT OWN_REVIEW")

    monkeypatch.setattr(Review.objects, "filter", fail)
    body = read(browser(world[0][1]), 500)
    assert "FOREIGN" not in str(body) and "OWN_REVIEW" not in str(body)
