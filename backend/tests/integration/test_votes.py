"""Vote and shortlist creation: authority, lifecycle, ordering and curator cycle."""

import json
from datetime import datetime, timezone

import pytest
from django.db import IntegrityError, transaction
from django.test import Client
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator

from books.models import Book
from config.contract import read_contract, resolve
from users.models import CuratorAssignment, User
from votes.models import Vote, VoteCandidate

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 13, 12, tzinfo=timezone.utc)
DOC = read_contract()
VOTES = "/api/votes"
ONE = "/api/votes/{voteId}"
CANDIDATES = "/api/votes/{voteId}/candidates"
ORDER = "/api/votes/{voteId}/candidates/order"
REMOVE = "/api/votes/{voteId}/candidates/{bookId}"
OPEN = "/api/votes/{voteId}/open"


@pytest.fixture
def world(monkeypatch):
    monkeypatch.setattr(django_timezone, "now", lambda: NOW)
    users = [
        User.objects.create_user(
            f"2000000000000000{index:02d}",
            approved=True,
            role="admin" if index == 1 else "member",
            display_name=f"Fictional reader {index}",
        )
        for index in range(1, 5)
    ]
    books = [
        Book.objects.create(title=f"Fictional book {index}", authors=["A. Writer"])
        for index in range(1, 5)
    ]
    admin, curator, member, other = users
    assignment = CuratorAssignment.objects.create(member=curator, assigned_at=NOW)
    return admin, curator, member, other, books, assignment


def browser(actor=None):
    client = Client(enforce_csrf_checks=True)
    if actor:
        client.force_login(actor)
    client.get("/api/session")
    return client


def call(client, method, path, body=None, csrf=True):
    extra = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    kwargs = {"content_type": "application/json", **extra}
    if body is not None:
        kwargs["data"] = body if isinstance(body, str) else json.dumps(body)
    return getattr(client, method)(path, **kwargs)


def checked(response, status=200, path=VOTES, method="get"):
    assert response.status_code == status, response.content
    data = response.json()
    if str(status) in DOC["paths"][path][method]["responses"]:
        content = resolve(DOC, DOC["paths"][path][method]["responses"][str(status)])
        schema = content["content"]["application/json"]["schema"]
        Draft202012Validator(schema).validate(data)
    return data


def make_vote(client):
    return checked(call(client, "post", VOTES), 201, method="post")


def add(client, vote_id, book, status=200):
    response = call(
        client, "post", f"{VOTES}/{vote_id}/candidates", {"bookId": str(book.pk)}
    )
    return checked(response, status, CANDIDATES, "post")


def titles(vote):
    return [row["book"]["title"] for row in vote["candidates"]]


def test_curator_builds_orders_and_opens_shortlist_linked_to_cycle(world):
    admin, curator, member, other, books, assignment = world
    client = browser(curator)
    overview = checked(client.get(VOTES))
    assert overview["canCreateVote"] is True and overview["current"] is None
    assert overview["curator"]["id"] == str(curator.pk)
    vote = make_vote(client)
    assert vote["status"] == "draft" and vote["curator"]["id"] == str(curator.pk)
    assert vote["canManage"] is True and vote["curatedByMe"] is True
    for book in books[:3]:
        vote = add(client, vote["id"], book)
    assert titles(vote) == [f"Fictional book {n}" for n in (1, 2, 3)]
    ids = [str(books[2].pk), str(books[0].pk), str(books[1].pk)]
    reordered = checked(
        call(client, "put", f"{VOTES}/{vote['id']}/candidates/order", {"bookIds": ids}),
        path=ORDER,
        method="put",
    )
    assert [row["book"]["id"] for row in reordered["candidates"]] == ids
    removed = checked(
        call(client, "delete", f"{VOTES}/{vote['id']}/candidates/{books[0].pk}"),
        path=REMOVE,
        method="delete",
    )
    assert titles(removed) == ["Fictional book 3", "Fictional book 2"]
    assert list(VoteCandidate.objects.values_list("position", flat=True)) == [1, 2]
    opened = checked(
        call(client, "post", f"{VOTES}/{vote['id']}/open"), path=OPEN, method="post"
    )
    assert opened["status"] == "open" and opened["openedAt"].startswith("2026-10-13")
    assert opened["closedAt"] is None and opened["outcome"] is None
    assert all(
        not c["approvals"] and not c["approvedByMe"] for c in opened["candidates"]
    )
    assert Vote.objects.get().curator_assignment_id == assignment.pk


def test_vote_keeps_recorded_cycle_when_current_curator_changes(world):
    admin, curator, member, other, books, assignment = world
    vote = make_vote(browser(curator))
    admin_client = browser(admin)
    call(admin_client, "put", "/api/admin/curator", {"memberId": str(member.pk)})
    assert CuratorAssignment.objects.count() == 2
    stored = Vote.objects.get()
    assert stored.curator_assignment_id == assignment.pk
    assert stored.curator_assignment.ended_at is not None
    seen = checked(browser(other).get(f"{VOTES}/{vote['id']}"), path=ONE)
    assert seen["curator"]["id"] == str(curator.pk)
    assert seen["canManage"] is False and seen["curatedByMe"] is False
    # The old curator loses authority; the new curator manages the same vote.
    checked(call(browser(curator), "post", f"{VOTES}/{vote['id']}/open"), 403)
    add(browser(member), vote["id"], books[0])
    assert Vote.objects.get().curator_assignment_id == assignment.pk
    # Clearing the curator keeps the vote's retained cycle and curator.
    call(admin_client, "put", "/api/admin/curator", {"memberId": None})
    again = checked(browser(other).get(f"{VOTES}/{vote['id']}"), path=ONE)
    assert again["curator"]["id"] == str(curator.pk)


def test_admin_override_creates_vote_for_current_curator(world):
    admin, curator, *_ = world
    vote = make_vote(browser(admin))
    assert vote["curator"]["id"] == str(curator.pk) and vote["curatedByMe"] is False
    assert vote["canManage"] is True


def test_ordinary_members_and_anonymous_are_refused_before_lookup(world):
    admin, curator, member, other, books, assignment = world
    vote = make_vote(browser(curator))
    anonymous = browser()
    member_client = browser(member)
    base = f"{VOTES}/{vote['id']}"
    calls = [
        ("post", VOTES, None),
        ("post", f"{base}/candidates", {"bookId": str(books[0].pk)}),
        ("put", f"{base}/candidates/order", {"bookIds": []}),
        ("delete", f"{base}/candidates/{books[0].pk}", None),
        ("post", f"{base}/open", None),
        # Unknown ids and bad bodies get the same refusal: authority is first.
        ("post", f"{VOTES}/999999/open", None),
        ("post", f"{VOTES}/999999/candidates", "not json"),
    ]
    for method, path, body in calls:
        assert call(anonymous, method, path, body).status_code == 401
        assert call(member_client, method, path, body).status_code == 403
    assert not VoteCandidate.objects.exists()
    checked(anonymous.get(VOTES), 401)
    checked(anonymous.get(f"{VOTES}/{vote['id']}"), 401, ONE)


def test_csrf_required_on_every_write(world):
    admin, curator, member, other, books, assignment = world
    client = browser(curator)
    vote = make_vote(client)
    base = f"{VOTES}/{vote['id']}"
    for method, path, body in [
        ("post", VOTES, None),
        ("post", f"{base}/candidates", {"bookId": str(books[0].pk)}),
        ("put", f"{base}/candidates/order", {"bookIds": []}),
        ("delete", f"{base}/candidates/{books[0].pk}", None),
        ("post", f"{base}/open", None),
    ]:
        assert call(client, method, path, body, csrf=False).status_code == 403


def test_revoked_actor_is_refused(world):
    admin, curator, *_ = world
    client = browser(curator)
    User.objects.filter(pk=curator.pk).update(revoked_at=NOW, approved=False)
    assert call(client, "post", VOTES).status_code == 401
    assert client.get(VOTES).status_code == 401


def test_create_conflicts(world):
    admin, curator, member, other, books, assignment = world
    client = browser(curator)
    make_vote(client)
    checked(call(client, "post", VOTES), 409, method="post")
    assert Vote.objects.count() == 1
    Vote.objects.all().delete()
    CuratorAssignment.objects.filter(current=True).update(current=False, ended_at=NOW)
    checked(call(browser(admin), "post", VOTES), 409, method="post")
    overview = checked(browser(admin).get(VOTES))
    assert overview["curator"] is None and overview["canCreateVote"] is False


def test_database_allows_only_one_unclosed_vote_and_consistent_dates(world):
    *_, assignment = world
    Vote.objects.create(curator_assignment=assignment)
    with pytest.raises(IntegrityError), transaction.atomic():
        Vote.objects.create(curator_assignment=assignment)
    Vote.objects.update(status="open", opened_at=NOW)
    with pytest.raises(IntegrityError), transaction.atomic():
        Vote.objects.create(curator_assignment=assignment)
    Vote.objects.update(status="closed", closed_at=NOW)
    Vote.objects.create(curator_assignment=assignment)
    with pytest.raises(IntegrityError), transaction.atomic():
        Vote.objects.filter(status="closed").update(closed_at=None)


def test_candidate_rules(world):
    admin, curator, member, other, books, assignment = world
    client = browser(curator)
    vote = make_vote(client)
    path = f"{VOTES}/{vote['id']}/candidates"
    add(client, vote["id"], books[0])
    add(client, vote["id"], books[0], 409)
    books[1].status = Book.Status.CHOSEN
    books[1].save()
    add(client, vote["id"], books[1], 409)
    for unknown in ("999999", "abc"):
        checked(
            call(client, "post", path, {"bookId": unknown}), 404, CANDIDATES, "post"
        )
    for bad in ({}, {"bookId": 1}, {"bookId": ""}, {"bookId": "1", "x": 1}, [], "nope"):
        checked(call(client, "post", path, bad), 400, CANDIDATES, "post")
    unknown_vote = call(client, "post", f"{VOTES}/999999/candidates", {"bookId": "1"})
    checked(unknown_vote, 404, CANDIDATES, "post")
    assert VoteCandidate.objects.count() == 1
    books[2].soft_delete(admin)
    add(client, vote["id"], books[2], 404)


def test_open_requires_two_and_open_removal_keeps_two(world):
    admin, curator, member, other, books, assignment = world
    client = browser(curator)
    vote = make_vote(client)
    base = f"{VOTES}/{vote['id']}"
    add(client, vote["id"], books[0])
    checked(call(client, "post", f"{base}/open"), 409, OPEN, "post")
    add(client, vote["id"], books[1])
    add(client, vote["id"], books[2])
    checked(call(client, "post", f"{base}/open"), 200, OPEN, "post")
    checked(call(client, "post", f"{base}/open"), 409, OPEN, "post")
    add(client, vote["id"], books[3])
    for book in books[:2]:
        response = call(client, "delete", f"{base}/candidates/{book.pk}")
        checked(response, 200, REMOVE, "delete")
    response = call(client, "delete", f"{base}/candidates/{books[2].pk}")
    checked(response, 409, REMOVE, "delete")
    for missing in (books[0].pk, "abc"):
        checked(
            call(client, "delete", f"{base}/candidates/{missing}"),
            404,
            REMOVE,
            "delete",
        )
    assert VoteCandidate.objects.count() == 2


def test_closed_vote_is_immutable_for_management(world):
    admin, curator, member, other, books, assignment = world
    client = browser(curator)
    vote = make_vote(client)
    base = f"{VOTES}/{vote['id']}"
    add(client, vote["id"], books[0])
    add(client, vote["id"], books[1])
    Vote.objects.update(status="closed", opened_at=NOW, closed_at=NOW)
    add(client, vote["id"], books[2], 409)
    response = call(client, "delete", f"{base}/candidates/{books[0].pk}")
    checked(response, 409, REMOVE, "delete")
    order = {"bookIds": [str(books[1].pk), str(books[0].pk)]}
    checked(call(client, "put", f"{base}/candidates/order", order), 409, ORDER, "put")
    checked(call(client, "post", f"{base}/open"), 409, OPEN, "post")
    seen = checked(client.get(base), path=ONE)
    assert titles(seen) == ["Fictional book 1", "Fictional book 2"]
    assert seen["canManage"] is False


def test_reorder_validation_and_atomic_refusal(world):
    admin, curator, member, other, books, assignment = world
    client = browser(curator)
    vote = make_vote(client)
    add(client, vote["id"], books[0])
    add(client, vote["id"], books[1])
    path = f"{VOTES}/{vote['id']}/candidates/order"
    one, two, three = (str(books[n].pk) for n in range(3))
    for body, status in [
        ({"bookIds": [two]}, 409),
        ({"bookIds": [one, two, three]}, 409),
        ({"bookIds": [one, one]}, 409),
        ({"bookIds": [one, two, "999999"]}, 404),
        ({"bookIds": [one, "abc"]}, 404),
        ({"bookIds": "x"}, 400),
        ({"bookIds": [1]}, 400),
        ({}, 400),
        ({"bookIds": [], "extra": 1}, 400),
    ]:
        checked(call(client, "put", path, body), status, ORDER, "put")
    stored = VoteCandidate.objects.order_by("position").values_list(
        "book_id", flat=True
    )
    assert list(stored) == [books[0].pk, books[1].pk]
    checked(call(client, "put", path, {"bookIds": [two, one]}), 200, ORDER, "put")
    assert list(stored.all()) == [books[1].pk, books[0].pk]
    unknown = call(client, "put", f"{VOTES}/999999/candidates/order", {"bookIds": []})
    checked(unknown, 404, ORDER, "put")


def test_vote_with_removed_book_is_hidden_whole_and_blocks_new_vote(world):
    admin, curator, member, other, books, assignment = world
    client = browser(curator)
    vote = make_vote(client)
    add(client, vote["id"], books[0])
    add(client, vote["id"], books[1])
    books[0].soft_delete(admin)
    reader = browser(other)
    checked(reader.get(f"{VOTES}/{vote['id']}"), 404, ONE)
    overview = checked(reader.get(VOTES))
    assert overview["current"] is None and overview["canCreateVote"] is False
    assert "Fictional book" not in json.dumps(overview)
    checked(call(client, "post", f"{VOTES}/{vote['id']}/open"), 409, OPEN, "post")
    checked(call(client, "post", VOTES), 409, method="post")
    books[0].restore(admin)
    restored = checked(reader.get(f"{VOTES}/{vote['id']}"), path=ONE)
    assert len(restored["candidates"]) == 2


def test_members_see_public_shortlist_without_management(world):
    admin, curator, member, other, books, assignment = world
    vote = make_vote(browser(curator))
    add(browser(curator), vote["id"], books[0])
    seen = checked(browser(member).get(VOTES))
    assert seen["current"]["id"] == vote["id"]
    assert seen["current"]["canManage"] is False and seen["canCreateVote"] is False
    assert seen["history"] == []
    book = seen["current"]["candidates"][0]["book"]
    assert set(book) == {
        "id",
        "title",
        "authors",
        "coverUrl",
        "publicationDate",
        "pageCount",
    }


def test_nonnumeric_vote_id_is_not_found(world):
    admin, *_ = world
    client = browser(admin)
    checked(client.get(f"{VOTES}/abc"), 404, ONE)
    checked(call(client, "post", f"{VOTES}/abc/open"), 404, OPEN, "post")
