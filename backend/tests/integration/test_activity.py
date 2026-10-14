"""Native event creation/rollback and actual spoiler-filtered Home JSON."""

import json
from datetime import datetime, timedelta, timezone

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, connection, transaction
from django.db.models.deletion import ProtectedError
from django.test import Client
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from django.test.utils import CaptureQueriesContext
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator

from books.models import Book, BookCompletion
from config.contract import read_contract, resolve
from core.activity import RECENT_LIMIT, recent_activity, record_event
from core.models import ActivityEvent
from meetings.models import Meeting, ReadingAssignment, ReadingCompletion
from reviews.constants import CRITERIA
from reviews.models import Review
from users.models import CuratorAssignment, User
from votes.models import Vote, VoteCandidate

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
DOC = read_contract()


@pytest.fixture
def world(monkeypatch):
    monkeypatch.setattr(django_timezone, "now", lambda: NOW)
    users = [
        User.objects.create_user(
            f"7100000000000000{i:02d}",
            approved=True,
            role="admin" if i == 0 else "member",
            display_name=f"Fictional {i}",
        )
        for i in range(3)
    ]
    assignment = CuratorAssignment.objects.create(member=users[2])
    book = Book.objects.create(title="Fictional book", status="terminado")
    meeting = Meeting.objects.create(starts_at=NOW - timedelta(days=1), book=book)
    return users, book, meeting, assignment


def browser(actor=None):
    client = Client(enforce_csrf_checks=True)
    if actor:
        client.force_login(actor)
    client.get("/api/session")
    return client


def write(client, method, path, body=None, status=200):
    kwargs = (
        {"data": json.dumps(body), "content_type": "application/json"}
        if body is not None
        else {}
    )
    response = getattr(client, method)(
        path, **kwargs, HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value
    )
    assert response.status_code == status, response.content
    return response.json()


def feed(client):
    response = client.get("/api/home")
    assert response.status_code == 200, response.content
    schema = resolve(DOC, DOC["paths"]["/api/home"]["get"]["responses"]["200"])[
        "content"
    ]["application/json"]["schema"]
    Draft202012Validator(schema).validate(response.json())
    result = response.json()["recentActivity"]
    assert "PRIVATE_" not in json.dumps(result)
    assert all(set(row) == {"id", "type", "occurredAt", "text"} for row in result)
    return result


def rating(book, member):
    return Review.objects.create(
        book=book, member=member, text="PRIVATE_REVIEW", **dict.fromkeys(CRITERIA, 4)
    )


def test_vote_lifecycle_records_only_successful_nomination_open_and_close(world):
    users, _, _, assignment = world
    client = browser(users[2])
    vote = write(client, "post", "/api/votes", status=201)
    base = f"/api/votes/{vote['id']}"
    books = [Book.objects.create(title=f"Fictional candidate {i}") for i in range(2)]
    for book in books:
        write(client, "post", base + "/candidates", {"bookId": str(book.pk)})
    write(
        client, "post", base + "/candidates", {"bookId": str(books[0].pk)}, status=409
    )
    write(client, "post", base + "/open")
    write(client, "post", base + "/open", status=409)
    write(client, "post", base + "/close")
    write(client, "post", base + "/close", status=409)
    assert (
        list(ActivityEvent.objects.values_list("kind", flat=True)).count(
            "nomination_added"
        )
        == 2
    )
    assert ActivityEvent.objects.count() == 4
    assert all(
        row.actor_id == users[2].pk and row.payload == {} and row.occurred_at == NOW
        for row in ActivityEvent.objects.all()
    )
    assert len(feed(browser(users[1]))) == 4
    books[0].soft_delete(users[0])
    assert feed(browser(users[1])) == []
    books[0].restore(users[0])
    assert len(feed(browser(users[1]))) == 4


def test_review_submission_and_edits_record_one_event_with_no_prose(world):
    users, book, _, _ = world
    client = browser(users[1])
    BookCompletion.objects.create(book=book, member=users[1], completed_at=NOW)
    path = f"/api/books/{book.pk}/my-review"
    write(
        client,
        "put",
        path,
        {"scores": dict.fromkeys(CRITERIA, 4), "text": "PRIVATE_REVIEW"},
    )
    write(
        client,
        "put",
        path,
        {"scores": dict.fromkeys(CRITERIA, 5), "text": "PRIVATE_EDIT"},
    )
    assert ActivityEvent.objects.count() == 1
    event = ActivityEvent.objects.get()
    assert event.actor == users[1] and event.occurred_at == NOW and event.payload == {}
    assert feed(client)[0]["type"] == "review_available"
    assert feed(browser(users[0])) == []


@pytest.mark.parametrize("index", [0, 1, 2])
@pytest.mark.parametrize(
    "finished,submitted", [(False, False), (True, False), (False, True), (True, True)]
)
def test_review_event_gate_applies_to_every_role(world, index, finished, submitted):
    users, book, _, _ = world
    actor = users[index]
    author = users[2] if index == 1 else users[1]
    rating(book, author)
    record_event("review_available", author, book=book)
    if finished:
        BookCompletion.objects.create(book=book, member=actor, completed_at=NOW)
    if submitted:
        rating(book, actor)
    result = feed(browser(actor))
    assert len(result) == (1 if finished and submitted else 0)
    if result:
        User.objects.filter(pk=author.pk).update(approved=False, revoked_at=NOW)
        assert feed(browser(actor)) == result
        book.soft_delete(users[0])
        assert feed(browser(actor)) == []
        book.restore(users[0])
        assert len(feed(browser(actor))) == 1


def test_summary_publication_records_transition_and_requires_current_record_gate(world):
    users, book, meeting, _ = world
    client = browser(users[0])
    path = f"/api/admin/meetings/{meeting.pk}/record/summary"
    write(client, "put", path, {"text": "PRIVATE_DRAFT", "published": False})
    assert ActivityEvent.objects.count() == 0
    write(client, "put", path, {"text": "PRIVATE_SUMMARY", "published": True})
    write(client, "put", path, {"text": "PRIVATE_EDIT", "published": True})
    assert ActivityEvent.objects.count() == 1
    event = ActivityEvent.objects.get()
    assert event.actor == users[0] and event.occurred_at == NOW and event.payload == {}
    assert feed(client) == []  # Admin has no member-view override.
    meeting.record_safe = True
    meeting.save(update_fields=["record_safe"])
    assert len(feed(client)) == 1
    write(client, "put", path, {"text": "PRIVATE_DRAFT", "published": False})
    assert feed(client) == []


@pytest.mark.parametrize("index", [0, 1, 2])
def test_summary_assignment_completion_removed_reservations_and_cancellation(
    world, index
):
    users, book, meeting, _ = world
    actor = users[index]
    meeting.summary_text = "PRIVATE_SUMMARY"
    meeting.summary_published = True
    meeting.record_safe = True
    meeting.save()
    week = ReadingAssignment.objects.create(
        book=book,
        meeting=meeting,
        week_number=1,
        percent_start=0,
        percent_end=20,
        page_start=1,
        page_end=40,
    )
    record_event("summary_published", users[0], meeting=meeting)
    client = browser(actor)
    assert feed(client) == []
    ReadingCompletion.objects.create(assignment=week, member=actor, completed_at=NOW)
    assert len(feed(client)) == 1
    meeting.summary_published = False
    meeting.save(update_fields=["summary_published"])
    assert feed(client) == []
    meeting.summary_published = True
    meeting.save(update_fields=["summary_published"])
    assert len(feed(client)) == 1
    week.soft_delete(users[0])
    assert feed(client) == []
    week.restore(users[0])
    assert len(feed(client)) == 1
    meeting.cancelled = True
    meeting.save(update_fields=["cancelled"])
    assert feed(client) == []
    meeting.cancelled = False
    meeting.save(update_fields=["cancelled"])
    book.soft_delete(users[0])
    assert feed(client) == []


def test_filter_before_recent_limit_and_order_never_exposes_hidden_metadata(world):
    users, book, _, _ = world
    for i in range(RECENT_LIMIT + 1):
        record_event("book_selected", users[0], book=book)
        last = ActivityEvent.objects.latest("occurred_at")
        ActivityEvent.objects.filter(pk=last.pk).update(
            occurred_at=NOW - timedelta(days=i + 1)
        )
    expected = [
        str(pk)
        for pk in ActivityEvent.objects.order_by("-occurred_at", "-pk").values_list(
            "pk", flat=True
        )[:RECENT_LIMIT]
    ]
    for _ in range(RECENT_LIMIT + 5):
        record_event("review_available", users[1], book=book)
    result = feed(browser(users[0]))
    assert [row["id"] for row in result] == expected
    assert all(row["type"] == "book_selected" for row in result)


def test_book_selection_is_recorded_once_and_event_failure_rolls_back_book(
    world, monkeypatch
):
    from core import activity

    users, _, _, _ = world
    client = browser(users[0])
    book = Book.objects.create(title="Fictional selection")
    metadata = {
        "title": book.title,
        "authors": [],
        "status": "elegido",
        "coverAction": "keep",
        "description": None,
        "publicationDate": None,
        "publisher": None,
        "isbn": None,
        "pageCount": None,
        "readingStartDate": None,
        "readingEndDate": None,
        "plannedStartDate": None,
        "plannedEndDate": None,
        "datesApproximate": False,
    }

    def save(status):
        response = client.put(
            f"/api/admin/books/{book.pk}",
            encode_multipart(
                BOUNDARY,
                {
                    "metadata": SimpleUploadedFile(
                        "metadata",
                        json.dumps({**metadata, "status": status}).encode(),
                        content_type="application/json",
                    )
                },
            ),
            content_type=MULTIPART_CONTENT,
            HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
        )
        return response

    assert save("elegido").status_code == 200
    assert save("elegido").status_code == 200
    assert ActivityEvent.objects.filter(kind="book_selected", book=book).count() == 1
    assert save("propuesto").status_code == 200
    assert save("elegido").status_code == 200
    assert ActivityEvent.objects.filter(kind="book_selected", book=book).count() == 1
    another = Book.objects.create(title="Fictional rollback")
    book = another

    original = activity.record_event

    def fail(*args, **kwargs):
        original(*args, **kwargs)
        raise RuntimeError("Fictional failure after event storage")

    monkeypatch.setattr(activity, "record_event", fail)
    assert save("elegido").status_code == 500
    book.refresh_from_db()
    assert book.status == "propuesto"
    assert not ActivityEvent.objects.filter(book=book).exists()


def test_event_failure_rolls_back_review_and_summary(world, monkeypatch):
    from core import activity

    users, book, meeting, _ = world

    original = activity.record_event

    def fail(*args, **kwargs):
        original(*args, **kwargs)
        raise RuntimeError("Fictional failure after event storage")

    monkeypatch.setattr(activity, "record_event", fail)
    client = browser(users[1])
    BookCompletion.objects.create(book=book, member=users[1], completed_at=NOW)
    write(
        client,
        "put",
        f"/api/books/{book.pk}/my-review",
        {"scores": dict.fromkeys(CRITERIA, 4)},
        status=500,
    )
    assert not Review.objects.exists()
    write(
        browser(users[0]),
        "put",
        f"/api/admin/meetings/{meeting.pk}/record/summary",
        {"text": "PRIVATE_SUMMARY", "published": True},
        status=500,
    )
    meeting.refresh_from_db()
    assert meeting.summary_text is None and not meeting.summary_published
    assert not ActivityEvent.objects.exists()


def test_sql_rejects_unsafe_payload_and_invalid_subjects_and_protects_history(world):
    users, book, _, _ = world
    record_event("book_selected", users[0], book=book)
    for changes in [
        {"payload": {"text": "PRIVATE_CONTENT"}},
        {"kind": "unknown"},
        {"book": None},
    ]:
        with pytest.raises(IntegrityError), transaction.atomic():
            ActivityEvent.objects.update(**changes)
    with pytest.raises(ProtectedError):
        book.hard_delete()


def test_ineligible_identity_receives_no_home_events(world):
    users, book, _, _ = world
    record_event("book_selected", users[0], book=book)
    client = browser(users[1])
    User.objects.filter(pk=users[1].pk).update(approved=False, revoked_at=NOW)
    assert client.get("/api/home").status_code == 401
    assert browser().get("/api/home").status_code == 401


def catalogue_write(
    client, *, book=None, status="elegido", title="Fictional new book", csrf=True
):
    metadata = {
        "title": title,
        "authors": [],
        "status": status,
        "coverAction": "keep",
        "description": None,
        "publicationDate": None,
        "publisher": None,
        "isbn": None,
        "pageCount": None,
        "readingStartDate": None,
        "readingEndDate": None,
        "plannedStartDate": None,
        "plannedEndDate": None,
        "datesApproximate": False,
    }
    part = SimpleUploadedFile(
        "metadata", json.dumps(metadata).encode(), content_type="application/json"
    )
    return client.generic(
        "PUT" if book else "POST",
        f"/api/admin/books/{book.pk}" if book else "/api/admin/books",
        data=encode_multipart(BOUNDARY, {"metadata": part}),
        content_type=MULTIPART_CONTENT,
        **({"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}),
    )


@pytest.mark.parametrize("status", ["elegido", "leyendo"])
def test_new_official_book_records_server_actor_time_and_reselection_noop(
    world, status
):
    users, _, _, _ = world
    client = browser(users[0])
    response = catalogue_write(client, status=status)
    assert response.status_code == 201, response.content
    book = Book.objects.get(pk=response.json()["id"])
    event = ActivityEvent.objects.get(book=book)
    assert event.actor == users[0] and event.occurred_at == NOW and event.payload == {}
    assert (
        catalogue_write(
            client, book=book, status=status, title="Fictional edit"
        ).status_code
        == 200
    )
    assert catalogue_write(client, book=book, status="propuesto").status_code == 200
    assert catalogue_write(client, book=book, status=status).status_code == 200
    assert ActivityEvent.objects.count() == 1
    item = feed(client)[0]
    assert item["id"] == str(event.pk) and item["type"] == event.kind
    assert datetime.fromisoformat(item["occurredAt"].replace("Z", "+00:00")) == NOW


@pytest.mark.parametrize("operation", ["nomination", "open", "close"])
def test_vote_event_insert_then_failure_rolls_back_business_and_event(
    world, monkeypatch, operation
):
    from core import activity

    users, _, _, assignment = world
    vote = Vote.objects.create(curator_assignment=assignment)
    books = [Book.objects.create(title=f"Fictional rollback {i}") for i in range(2)]
    if operation != "nomination":
        for i, book in enumerate(books, 1):
            VoteCandidate.objects.create(vote=vote, book=book, position=i)
    if operation == "close":
        vote.status = "open"
        vote.opened_at = NOW
        vote.save()
    original = activity.record_event

    def fail(*args, **kwargs):
        original(*args, **kwargs)
        assert ActivityEvent.objects.exists()
        raise RuntimeError("Fictional failure after event insertion")

    monkeypatch.setattr(activity, "record_event", fail)
    path = f"/api/votes/{vote.pk}/" + (
        "candidates" if operation == "nomination" else operation
    )
    write(
        browser(users[2]),
        "post",
        path,
        {"bookId": str(books[0].pk)} if operation == "nomination" else None,
        status=500,
    )
    vote.refresh_from_db()
    assert vote.status == ("open" if operation == "close" else "draft")
    assert vote.closed_at is None and vote.winning_book_id is None
    assert vote.candidates.count() == (0 if operation == "nomination" else 2)
    assert not ActivityEvent.objects.exists()


@pytest.mark.parametrize(
    "operation", ["catalogue", "nomination", "open", "close", "summary", "review"]
)
@pytest.mark.parametrize("refusal", ["unauthorized", "invalid", "csrf"])
def test_refused_native_workflows_never_record_events(world, operation, refusal):
    users, book, meeting, assignment = world
    vote = Vote.objects.create(curator_assignment=assignment)
    actor = users[0] if operation in {"catalogue", "summary"} else users[2]
    if operation == "review":
        actor = users[1]
        BookCompletion.objects.create(book=book, member=actor, completed_at=NOW)
    if refusal == "unauthorized":
        actor = users[1] if operation != "review" else None
    client = browser(actor)
    if operation == "catalogue":
        response = catalogue_write(
            client,
            status="INVALID" if refusal == "invalid" else "elegido",
            csrf=refusal != "csrf",
        )
    else:
        method = "put" if operation in {"summary", "review"} else "post"
        path = {
            "nomination": f"/api/votes/{vote.pk}/candidates",
            "open": f"/api/votes/{vote.pk}/open",
            "close": f"/api/votes/{vote.pk}/close",
            "summary": f"/api/admin/meetings/{meeting.pk}/record/summary",
            "review": f"/api/books/{book.pk}/my-review",
        }[operation]
        body = {
            "nomination": {"bookId": "missing"},
            "summary": {"text": "PRIVATE_SUMMARY", "published": True},
            "review": {"scores": dict.fromkeys(CRITERIA, 4)},
        }.get(operation)
        if refusal == "invalid" and operation in {"summary", "review"}:
            body = {}
        response = getattr(client, method)(
            path,
            data=json.dumps(body) if body is not None else "",
            content_type="application/json",
            **(
                {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value}
                if refusal != "csrf"
                else {}
            ),
        )
    assert response.status_code in {400, 401, 403, 404, 409}, response.content
    assert not ActivityEvent.objects.exists()


@pytest.mark.parametrize("index", [0, 1, 2])
def test_current_review_completion_relocks_without_role_override(world, index):
    users, book, _, _ = world
    actor = users[index]
    rating(book, actor)
    completion = BookCompletion.objects.create(
        book=book, member=actor, completed_at=NOW
    )
    record_event("review_available", actor, book=book)
    client = browser(actor)
    assert len(feed(client)) == 1
    completion.completed_at = None
    completion.save()
    assert feed(client) == []


@pytest.mark.parametrize("index", [0, 1, 2])
def test_summary_unlinked_safety_retention_invalid_parent_and_no_content_query(
    world, index
):
    users, book, meeting, _ = world
    actor = users[index]
    meeting.summary_text = "PRIVATE_SUMMARY"
    meeting.summary_published = True
    meeting.save()
    record_event("summary_published", users[0], meeting=meeting)
    client = browser(actor)
    assert feed(client) == []
    meeting.record_safe = True
    meeting.save()
    assert len(feed(client)) == 1
    with CaptureQueriesContext(connection) as queries:
        assert len(recent_activity(actor)) == 1
    # Eligibility may check summary existence in WHERE, but never select its text.
    selects = [
        q["sql"].split(" FROM ", 1)[0].lower()
        for q in queries
        if q["sql"].lstrip().upper().startswith("SELECT")
    ]
    assert all(
        "summary_text" not in sql and "meetinghighlight" not in sql for sql in selects
    )
    meeting.soft_delete(users[0])
    assert feed(client) == []
    meeting.restore(users[0])
    assert len(feed(client)) == 1
    other = Book.objects.create(title="Fictional wrong parent", status="terminado")
    week = ReadingAssignment.objects.create(
        book=other,
        meeting=meeting,
        week_number=1,
        percent_start=0,
        percent_end=20,
        page_start=1,
        page_end=40,
    )
    ReadingCompletion.objects.create(assignment=week, member=actor, completed_at=NOW)
    assert feed(client) == []


def test_ordinary_book_retention_actor_revocation_tie_order_and_empty(world):
    users, book, _, _ = world
    client = browser(users[1])
    assert feed(client) == []
    for _ in range(3):
        record_event("book_selected", users[2], book=book)
    rows = list(ActivityEvent.objects.order_by("-pk"))
    result = feed(client)
    assert [r["id"] for r in result] == [str(r.pk) for r in rows]
    assert all(
        datetime.fromisoformat(r["occurredAt"].replace("Z", "+00:00")) == NOW
        for r in result
    )
    User.objects.filter(pk=users[2].pk).update(approved=False, revoked_at=NOW)
    assert feed(client) == result
    assert all(row.actor_id == users[2].pk for row in ActivityEvent.objects.all())
    book.soft_delete(users[0])
    assert feed(client) == []
    book.restore(users[0])
    assert feed(client) == result
    with pytest.raises(ProtectedError):
        users[2].delete()


def test_all_subject_references_are_protected_and_malformed_combinations_rejected(
    world,
):
    users, book, meeting, assignment = world
    vote = Vote.objects.create(curator_assignment=assignment)
    record_event("summary_published", users[0], meeting=meeting)
    record_event("vote_opened", users[0], vote=vote)
    for subject in (meeting, vote):
        with pytest.raises(ProtectedError):
            if isinstance(subject, Meeting):
                subject.hard_delete()
            else:
                subject.delete()
    for kind, subjects in [
        ("book_selected", {"book": book, "vote": vote}),
        ("review_available", {"book": book, "meeting": meeting}),
        ("nomination_added", {"book": book}),
        ("vote_opened", {"vote": vote, "book": book}),
        ("summary_published", {"meeting": meeting, "vote": vote}),
    ]:
        with pytest.raises(IntegrityError), transaction.atomic():
            record_event(kind, users[0], **subjects)
    assert ActivityEvent.objects.count() == 2
