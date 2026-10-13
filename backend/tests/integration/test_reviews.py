"""Review storage constraints and completion invariants using real SQL/HTTP."""

from datetime import datetime, timezone

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import Client
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator

from books.models import Book, BookCompletion
from config.contract import read_contract, resolve
from reviews.constants import CRITERIA
from reviews.models import Review
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
FINISHED = "/api/books/{bookId}/finished"
DOC = read_contract()


@pytest.fixture
def world(monkeypatch):
    monkeypatch.setattr(django_timezone, "now", lambda: NOW)
    users = [
        User.objects.create_user(
            f"4000000000000000{n:02d}",
            approved=True,
            role="admin" if n == 1 else "member",
            display_name=f"Fictional reader {n}",
        )
        for n in range(1, 4)
    ]
    book = Book.objects.create(
        title="Fictional review book", authors=["A. Writer"], status="terminado"
    )
    return users, book


def scores(value=3):
    return dict.fromkeys(CRITERIA, value)


def browser(actor):
    client = Client(enforce_csrf_checks=True)
    client.force_login(actor)
    client.get("/api/session")
    return client


def finished(client, book, value, status=200):
    response = client.put(
        f"/api/books/{book.pk}/finished",
        data={"finished": value},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == status, response.content
    content = resolve(DOC, DOC["paths"][FINISHED]["put"]["responses"][str(status)])
    Draft202012Validator(content["content"]["application/json"]["schema"]).validate(
        response.json()
    )
    return response.json()


def test_review_preserves_five_scores_submission_and_optional_text(world):
    users, book = world
    values = dict(zip(CRITERIA, [5, 4.5, 3, 4, 2.5], strict=True))
    row = Review(book=book, member=users[1], text="  Texto ficticio  ", **values)
    row.full_clean()
    row.save()
    row.refresh_from_db()
    assert row.overall == 3.8 and row.text == "Texto ficticio"
    assert row.submitted_at == NOW and row.edited_at is None
    assert [float(row.scores[c]) for c in CRITERIA] == [5, 4.5, 3, 4, 2.5]
    with pytest.raises(IntegrityError), transaction.atomic():
        Review.objects.create(book=book, member=users[1], **scores())


@pytest.mark.parametrize("criterion", CRITERIA)
@pytest.mark.parametrize("bad", [None, 0, 5.5, 3.25])
def test_sql_rejects_missing_range_and_step_violations(world, criterion, bad):
    users, book = world
    row = Review.objects.create(book=book, member=users[1], **scores())
    with pytest.raises(IntegrityError), transaction.atomic():
        Review.objects.filter(pk=row.pk).update(**{criterion: bad})


@pytest.mark.parametrize("bad", [None, True, "3", 0, 5.5, 3.25])
def test_model_validation_rejects_invalid_scores_before_save(world, bad):
    users, book = world
    row = Review(book=book, member=users[1], **scores())
    row.huella = bad
    with pytest.raises(ValidationError):
        row.full_clean()


def test_database_limits_review_text_and_edit_timestamp(world):
    users, book = world
    row = Review.objects.create(book=book, member=users[1], **scores())
    for values in ({"text": "x" * 5001}, {"edited_at": NOW.replace(year=2025)}):
        with pytest.raises(IntegrityError), transaction.atomic():
            Review.objects.filter(pk=row.pk).update(**values)


@pytest.mark.parametrize("actor_index", [0, 1])
def test_cannot_clear_personal_completion_after_submitting_own_review(
    world, actor_index
):
    users, book = world
    actor = users[actor_index]
    client = browser(actor)
    finished(client, book, True)
    row = Review.objects.create(book=book, member=actor, **scores())
    finished(client, book, False, 409)
    assert BookCompletion.objects.get(book=book, member=actor).completed_at == NOW
    assert Review.objects.get(pk=row.pk).overall == 3.0
    # Someone else's submitted review never controls this member's completion.
    other = browser(users[2])
    finished(other, book, True)
    finished(other, book, False)
    assert BookCompletion.objects.get(book=book, member=users[2]).completed_at is None
