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
from users.models import CuratorAssignment, User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
FINISHED = "/api/books/{bookId}/finished"
SAVE = "/api/books/{bookId}/my-review"
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
    CuratorAssignment.objects.create(member=users[2])
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


def submit(client, book_id, value, status=200, csrf=True):
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    response = client.put(
        f"/api/books/{book_id}/my-review",
        data=value,
        content_type="application/json",
        **headers,
    )
    assert response.status_code == status, response.content
    content = resolve(DOC, DOC["paths"][SAVE]["put"]["responses"][str(status)])
    Draft202012Validator(content["content"]["application/json"]["schema"]).validate(
        response.json()
    )
    return response.json()


def test_member_submits_and_edits_own_review_preserving_submission(world, monkeypatch):
    users, book = world
    client = browser(users[1])
    finished(client, book, True)
    values = dict(zip(CRITERIA, [5, 4.5, 3, 4, 2.5], strict=True))
    created = submit(
        client,
        book.pk,
        {"scores": values, "text": "  <b>Reseña ficticia</b>\nliteral  "},
    )
    assert created["myReview"]["overall"] == 3.8
    assert created["myReview"]["text"] == "<b>Reseña ficticia</b>\nliteral"
    assert created["myReview"]["editedAt"] is None
    assert created["club"]["status"] == "visible"
    assert created["club"]["reviewCount"] == 1
    later = NOW.replace(hour=13)
    monkeypatch.setattr(django_timezone, "now", lambda: later)
    edited = submit(client, book.pk, {"scores": scores(4.5)})
    assert Review.objects.count() == 1
    assert edited["myReview"]["overall"] == 4.5 and edited["myReview"]["text"] is None
    assert edited["myReview"]["submittedAt"] == created["myReview"]["submittedAt"]
    assert datetime.fromisoformat(edited["myReview"]["editedAt"]) == later
    actual = client.get(f"/api/books/{book.pk}/ratings").json()
    assert actual["myReview"] == edited["myReview"]
    foreign = browser(users[2]).get(f"/api/books/{book.pk}/ratings").json()
    assert foreign["myReview"] is None and foreign["club"] == {"status": "locked"}


@pytest.mark.parametrize("status", ["leyendo", "terminado", "archivado"])
def test_official_current_and_historical_books_use_same_submission(world, status):
    users, book = world
    book.status = status
    book.save()
    client = browser(users[0])
    finished(client, book, True)
    result = submit(client, book.pk, {"scores": scores(2.5), "text": "  "})
    assert result["myReview"]["text"] is None and result["myReview"]["overall"] == 2.5


def test_review_membership_ownership_csrf_and_lifecycle_precedence(world):
    users, book = world
    actor, other = users[1:]
    anonymous = Client(enforce_csrf_checks=True)
    anonymous.get("/api/session")
    submit(anonymous, "unknown", "nope", 401)
    client = browser(actor)
    for key in ("userId", "memberId", "Owner"):
        submit(client, "unknown", {"scores": scores(), key: str(other.pk)}, 403)
    submit(client, "unknown", "nope", 404)
    submit(client, book.pk, "nope", 409)
    finished(client, book, True)
    submit(client, book.pk, {"scores": scores()}, 403, csrf=False)
    for status in ("propuesto", "elegido"):
        book.status = status
        book.save()
        submit(client, book.pk, {"scores": scores()}, 409)
    book.status = "terminado"
    book.save()
    book.soft_delete(users[0])
    submit(client, book.pk, {"scores": scores()}, 404)
    book.restore(users[0])
    User.objects.filter(pk=actor.pk).update(approved=False, revoked_at=NOW)
    submit(client, book.pk, {"scores": scores()}, 401)
    assert not Review.objects.exists()


@pytest.mark.parametrize(
    "invalid",
    [
        {},
        {"scores": {}},
        {"scores": {**scores(), "huella": True}},
        {"scores": {**scores(), "huella": 3.25}},
        {"scores": scores(), "text": 1},
        {"scores": scores(), "text": "x" * 5001},
        {"scores": scores(), "text": "\x00"},
        {"scores": scores(), "text": "\ud800"},
        {"scores": scores(), "extra": 1},
    ],
)
def test_invalid_review_edit_never_changes_persisted_data(world, invalid):
    users, book = world
    client = browser(users[1])
    finished(client, book, True)
    original = submit(
        client, book.pk, {"scores": scores(4), "text": "Fictional original"}
    )
    submit(client, book.pk, invalid, 400)
    assert client.get(f"/api/books/{book.pk}/ratings").json() == original


def test_trimmed_text_limit_and_admin_cannot_edit_another_member(world):
    users, book = world
    for actor in users[:2]:
        finished(browser(actor), book, True)
    original = submit(
        browser(users[1]),
        book.pk,
        {"scores": scores(1), "text": "  " + "x" * 5000 + "  "},
    )
    assert len(original["myReview"]["text"]) == 5000
    submit(
        browser(users[0]),
        book.pk,
        {"scores": scores(5), "text": "Admin's own fictional review"},
    )
    assert Review.objects.count() == 2
    submit(
        browser(users[0]),
        book.pk,
        {"scores": scores(3), "userId": str(users[1].pk)},
        403,
    )
    assert Review.objects.get(book=book, member=users[1]).text == "x" * 5000
    assert Review.objects.get(book=book, member=users[1]).overall == 1


def ratings(client, book, status=200):
    response = client.get(f"/api/books/{book.pk}/ratings")
    assert response.status_code == status, response.content
    content = resolve(
        DOC,
        DOC["paths"]["/api/books/{bookId}/ratings"]["get"]["responses"][str(status)],
    )
    Draft202012Validator(content["content"]["application/json"]["schema"]).validate(
        response.json()
    )
    return response.json()


@pytest.mark.parametrize("actor_index", [0, 1, 2])
@pytest.mark.parametrize(
    "complete,submitted", [(False, False), (True, False), (False, True), (True, True)]
)
def test_every_role_requires_both_personal_completion_and_own_review(
    world, actor_index, complete, submitted
):
    users, book = world
    actor = users[actor_index]
    foreign = users[(actor_index + 1) % 3]
    Review.objects.create(
        book=book, member=foreign, text="Foreign fictional spoiler", **scores(5)
    )
    if complete:
        BookCompletion.objects.create(book=book, member=actor, completed_at=NOW)
    if submitted:
        Review.objects.create(
            book=book, member=actor, text="Own fictional review", **scores(2)
        )
    result = ratings(browser(actor), book)
    assert (result["myReview"] is not None) == submitted
    if complete and submitted:
        assert result["club"]["status"] == "visible"
        assert result["club"]["reviewCount"] == 2
        assert result["club"]["overallMean"] == 3.5
        assert result["club"]["criterionMeans"] == scores(3.5)
        assert sum(row["isMine"] for row in result["club"]["reviews"]) == 1
    else:
        assert result["club"] == {"status": "locked"}
        assert "Foreign fictional spoiler" not in str(result)
        assert "reviewCount" not in str(result) and "overallMean" not in str(result)
        assert foreign.display_name not in str(result)


def test_submission_unlocks_club_and_edit_recalculates_equal_weight_means(world):
    users, book = world
    Review.objects.create(
        book=book, member=users[2], text="Foreign fictional review", **scores(5)
    )
    client = browser(users[1])
    assert ratings(client, book)["club"] == {"status": "locked"}
    assert finished(client, book, True)["club"] == {"status": "locked"}
    unlocked = submit(client, book.pk, {"scores": scores(1)})
    assert unlocked["club"]["overallMean"] == 3 and unlocked["club"]["reviewCount"] == 2
    edited = submit(client, book.pk, {"scores": scores(4)})
    assert edited["club"]["overallMean"] == 4.5
    assert edited["club"]["criterionMeans"] == scores(4.5)
    assert ratings(client, book)["club"] == edited["club"]
    assert finished(client, book, True)["club"] == edited["club"]


def test_existing_metadata_surfaces_never_leak_foreign_review_or_aggregate(world):
    users, book = world
    secret = "Foreign fictional spoiler sentinel"
    Review.objects.create(book=book, member=users[2], text=secret, **scores(4.5))
    for actor in users[:2]:
        client = browser(actor)
        for path in (
            "/api/home",
            "/api/books",
            f"/api/books/{book.pk}",
            "/api/members",
            f"/api/members/{users[2].pk}",
            "/api/meetings",
            "/api/rating-rubric",
        ):
            response = client.get(path)
            assert response.status_code == 200, response.content
            body = response.content.decode()
            assert (
                secret not in body
                and '"overallMean"' not in body
                and '"criterionMeans"' not in body
            )


def test_removed_book_or_revoked_viewer_cannot_read_unlocked_ratings(world):
    users, book = world
    for actor in users[:2]:
        BookCompletion.objects.create(book=book, member=actor, completed_at=NOW)
        Review.objects.create(book=book, member=actor, **scores(4))
    client = browser(users[1])
    assert ratings(client, book)["club"]["status"] == "visible"
    book.soft_delete(users[0])
    ratings(client, book, 404)
    book.restore(users[0])
    assert ratings(client, book)["club"]["reviewCount"] == 2
    User.objects.filter(pk=users[1].pk).update(approved=False, revoked_at=NOW)
    ratings(client, book, 401)
