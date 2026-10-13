"""Native admin record lifecycle, safe projections and retained highlight slots."""

import json
from datetime import datetime, timedelta, timezone

import pytest
from django.db import IntegrityError, transaction
from django.test import Client
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator

from books.models import Book
from config.contract import read_contract, resolve
from meetings.calendar import bin_projection
from meetings.models import Meeting, MeetingHighlight, ReadingAssignment
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 13, 12, tzinfo=timezone.utc)
DOC = read_contract()
BASE = "/api/admin/meetings/{meetingId}/record"
PATHS = [
    ("get", "", None),
    ("put", "/summary", {"text": "PRIVATE_SUMMARY", "published": True}),
    (
        "post",
        "/highlights",
        {
            "text": "PRIVATE_HIGHLIGHT",
            "kind": "quote",
            "speakerIds": [],
            "published": False,
        },
    ),
    ("put", "/highlights/order", {"ids": []}),
    ("put", "/highlights/{highlightId}", {}),
    ("delete", "/highlights/{highlightId}", None),
    ("put", "/safe", {"safe": True}),
]


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setattr(django_timezone, "now", lambda: NOW)
    admin = User.objects.create_user(
        "100000000000000001",
        approved=True,
        role="admin",
        display_name="Fictional admin",
    )
    member = User.objects.create_user(
        "100000000000000002", approved=True, display_name="Fictional reader"
    )
    revoked = User.objects.create_user(
        "100000000000000003",
        approved=False,
        revoked_at=NOW,
        display_name="Fictional historical speaker",
    )
    book = Book.objects.create(title="Fictional book", status="leyendo")
    meeting = Meeting.objects.create(book=book, starts_at=NOW - timedelta(days=1))
    return admin, member, revoked, book, meeting


def browser(actor=None):
    client = Client(enforce_csrf_checks=True)
    if actor:
        client.force_login(actor)
    client.get("/api/session")
    return client


def call(client, meeting, method, suffix, value=None, highlight_id="999999", csrf=True):
    path = BASE + suffix
    url = path.replace("{meetingId}", str(meeting.pk)).replace(
        "{highlightId}", str(highlight_id)
    )
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    return getattr(client, method)(
        url,
        **(
            {"data": json.dumps(value), "content_type": "application/json"}
            if value is not None
            else {}
        ),
        **headers,
    )


def checked(response, status=200, method="get", suffix=""):
    assert response.status_code == status, response.content
    result = response.json()
    schema = resolve(
        DOC, DOC["paths"][BASE + suffix][method]["responses"][str(status)]
    )["content"]["application/json"]["schema"]
    Draft202012Validator(schema).validate(result)
    return result


def highlight(text="PRIVATE_HIGHLIGHT", speakers=None, published=False):
    return {
        "text": text,
        "kind": "quote",
        "speakerIds": speakers or [],
        "published": published,
    }


def test_native_admin_lifecycle_retains_removed_slots_and_historical_attribution(setup):
    admin, member, revoked, _, meeting = setup
    client = browser(admin)
    literal = "<script>PRIVATE_SUMMARY</script>\n**literal**"
    result = checked(
        call(
            client,
            meeting,
            "put",
            "/summary",
            {"text": "  " + literal + "  ", "published": True},
        ),
        method="put",
        suffix="/summary",
    )
    assert result["summary"] == {"text": literal, "published": True}
    first = checked(
        call(
            client, meeting, "post", "/highlights", highlight(speakers=[str(member.pk)])
        ),
        201,
        "post",
        "/highlights",
    )["highlights"][0]["id"]
    second = checked(
        call(
            client,
            meeting,
            "post",
            "/highlights",
            highlight("PRIVATE_SECOND", published=True),
        ),
        201,
        "post",
        "/highlights",
    )["highlights"][1]["id"]
    third = checked(
        call(client, meeting, "post", "/highlights", highlight("PRIVATE_THIRD")),
        201,
        "post",
        "/highlights",
    )["highlights"][2]["id"]
    User.objects.filter(pk=member.pk).update(approved=False, revoked_at=NOW)
    result = checked(
        call(
            client,
            meeting,
            "put",
            "/highlights/{highlightId}",
            highlight("PRIVATE_EDITED", [str(member.pk)], True),
            first,
        ),
        method="put",
        suffix="/highlights/{highlightId}",
    )
    assert result["highlights"][0]["speakerIds"] == [str(member.pk)]
    checked(
        call(
            client, meeting, "post", "/highlights", highlight(speakers=[str(member.pk)])
        ),
        400,
        "post",
        "/highlights",
    )
    checked(
        call(
            client,
            meeting,
            "put",
            "/highlights/{highlightId}",
            highlight(speakers=[str(revoked.pk)]),
            first,
        ),
        400,
        "put",
        "/highlights/{highlightId}",
    )
    checked(
        call(
            client, meeting, "delete", "/highlights/{highlightId}", highlight_id=second
        ),
        method="delete",
        suffix="/highlights/{highlightId}",
    )
    removed = MeetingHighlight.all_objects.get(pk=second)
    assert (
        removed.position == 2
        and removed.text == "PRIVATE_SECOND"
        and removed.published is True
    )
    assert removed.purge_due_at == NOW + timedelta(days=30)
    result = checked(
        call(client, meeting, "put", "/highlights/order", {"ids": [third, first]}),
        method="put",
        suffix="/highlights/order",
    )
    assert [row["id"] for row in result["highlights"]] == [third, first]
    assert list(
        meeting.highlights.order_by("position").values_list("position", flat=True)
    ) == [1, 3]
    bins = bin_projection()
    assert "PRIVATE" not in str(bins)
    assert (
        next(row for row in bins if row["type"] == "highlight")["label"]
        == "Momento destacado"
    )
    checked(
        call(client, meeting, "put", "/summary", {"text": "   ", "published": False}),
        method="put",
        suffix="/summary",
    )
    assert Meeting.objects.get(pk=meeting.pk).summary_text is None
    checked(
        call(client, meeting, "put", "/safe", {"safe": True}),
        method="put",
        suffix="/safe",
    )
    assert Meeting.objects.get(pk=meeting.pk).record_safe is True


@pytest.mark.parametrize("method,suffix,value", PATHS)
def test_all_record_routes_refuse_nonadmin_and_csrf_before_lookup(
    setup, method, suffix, value
):
    admin, member, *_ = setup
    missing = Meeting(pk=999999)
    checked(call(browser(), missing, method, suffix, value), 401, method, suffix)
    checked(call(browser(member), missing, method, suffix, value), 403, method, suffix)
    if method != "get":
        checked(
            call(browser(admin), missing, method, suffix, value, csrf=False),
            403,
            method,
            suffix,
        )
    checked(call(browser(admin), missing, method, suffix, value), 404, method, suffix)


@pytest.mark.parametrize(
    "value",
    [
        {"text": " ", "published": True},
        {"text": "x" * 10001, "published": False},
        {"text": "x\x00y", "published": False},
        {"text": "x", "published": 1},
        {"text": "x", "published": False, "extra": 1},
    ],
)
def test_invalid_summary_changes_nothing(setup, value):
    admin, _, _, _, meeting = setup
    checked(
        call(browser(admin), meeting, "put", "/summary", value), 400, "put", "/summary"
    )
    meeting.refresh_from_db()
    assert meeting.summary_text is None


@pytest.mark.parametrize(
    "value",
    [
        highlight(" "),
        highlight("x" * 2001),
        highlight("x\x00y"),
        {**highlight(), "kind": "script"},
        {**highlight(), "published": "true"},
        highlight(speakers=["2", "2"]),
        highlight(speakers=["999999"]),
        {**highlight(), "actorId": "1"},
    ],
)
def test_invalid_highlight_and_foreign_lookup_have_no_writes(setup, value):
    admin, _, _, _, meeting = setup
    client = browser(admin)
    checked(
        call(client, meeting, "post", "/highlights", value), 400, "post", "/highlights"
    )
    foreign = Meeting.objects.create(starts_at=NOW)
    row = MeetingHighlight.objects.create(
        meeting=foreign, position=1, text="PRIVATE_FOREIGN", kind="quote"
    )
    checked(
        call(client, meeting, "put", "/highlights/{highlightId}", value, row.pk),
        404,
        "put",
        "/highlights/{highlightId}",
    )
    assert meeting.highlights.count() == 0


def test_exact_order_safe_reservations_removed_parent_and_atomic_failures(
    setup, monkeypatch
):
    admin, member, _, _, meeting = setup
    client = browser(admin)
    first = MeetingHighlight.objects.create(
        meeting=meeting, position=1, text="PRIVATE_ONE", kind="quote"
    )
    second = MeetingHighlight.objects.create(
        meeting=meeting, position=2, text="PRIVATE_TWO", kind="quote"
    )
    for keys in [[], [str(first.pk)], [str(first.pk)] * 2, [str(first.pk), "99999"]]:
        checked(
            call(client, meeting, "put", "/highlights/order", {"ids": keys}),
            400,
            "put",
            "/highlights/order",
        )
    week = ReadingAssignment.objects.create(
        meeting=meeting,
        book=meeting.book,
        week_number=1,
        percent_start=0,
        percent_end=1,
        page_start=1,
        page_end=2,
    )
    week.soft_delete(admin)
    checked(call(client, meeting, "put", "/safe", {}), 409, "put", "/safe")

    def fail(*args, **kwargs):
        raise RuntimeError("PRIVATE_FAILURE")

    monkeypatch.setattr(MeetingHighlight, "save", fail)
    checked(
        call(
            client,
            meeting,
            "put",
            "/highlights/order",
            {"ids": [str(second.pk), str(first.pk)]},
        ),
        500,
        "put",
        "/highlights/order",
    )
    assert list(
        meeting.highlights.order_by("position").values_list("pk", flat=True)
    ) == [first.pk, second.pk]
    meeting.soft_delete(admin)
    checked(call(client, meeting, "put", "/summary", {}), 404, "put", "/summary")
    User.objects.filter(pk=admin.pk).update(role="member")
    checked(call(client, meeting, "get", ""), 403)


@pytest.mark.parametrize("change", ["kind", "text", "position", "duplicate"])
def test_sql_highlight_invariants_bypass_model_validation(setup, change):
    _, _, _, _, meeting = setup
    row = MeetingHighlight.objects.create(
        meeting=meeting, position=1, text="Fictional", kind="quote"
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        if change == "duplicate":
            MeetingHighlight.objects.create(
                meeting=meeting, position=1, text="Fictional", kind="quote"
            )
        else:
            MeetingHighlight.objects.filter(pk=row.pk).update(
                **{change: {"kind": "script", "text": " ", "position": 0}[change]}
            )


def test_malformed_unicode_refused_and_late_storage_value_error_rolls_back(
    setup, monkeypatch
):
    admin, _, _, _, meeting = setup
    client = browser(admin)
    checked(
        call(
            client, meeting, "put", "/summary", {"text": "\ud800", "published": False}
        ),
        400,
        "put",
        "/summary",
    )
    checked(
        call(client, meeting, "post", "/highlights", highlight("\udfff")),
        400,
        "post",
        "/highlights",
    )
    rows = [
        MeetingHighlight.objects.create(
            meeting=meeting, position=index, text="Fictional", kind="quote"
        )
        for index in [1, 2]
    ]
    original = MeetingHighlight.save
    writes = 0

    def fail_later(row, *args, **kwargs):
        nonlocal writes
        writes += 1
        if writes == 2:
            raise ValueError("PRIVATE_STORAGE_FAILURE")
        return original(row, *args, **kwargs)

    monkeypatch.setattr(MeetingHighlight, "save", fail_later)
    checked(
        call(
            client,
            meeting,
            "put",
            "/highlights/order",
            {"ids": [str(rows[1].pk), str(rows[0].pk)]},
        ),
        500,
        "put",
        "/highlights/order",
    )
    assert list(
        meeting.highlights.order_by("position").values_list("pk", "position")
    ) == [(rows[0].pk, 1), (rows[1].pk, 2)]


@pytest.mark.parametrize("role", ["member", "admin"])
def test_member_projections_never_receive_drafts_or_published_content_before_gate(
    setup, role
):
    admin, member, _, book, meeting = setup
    Meeting.objects.filter(pk=meeting.pk).update(
        summary_text="PRIVATE_SUMMARY", summary_published=True, record_safe=False
    )
    MeetingHighlight.objects.create(
        meeting=meeting, position=1, text="PRIVATE_DRAFT", kind="quote"
    )
    MeetingHighlight.objects.create(
        meeting=meeting,
        position=2,
        text="PRIVATE_PUBLISHED",
        kind="quote",
        published=True,
    )
    client = browser(admin if role == "admin" else member)
    for path in [
        "/api/home",
        "/api/books",
        "/api/meetings",
        f"/api/books/{book.pk}",
        f"/api/meetings/{meeting.pk}",
    ]:
        response = client.get(path)
        assert response.status_code == 200
        assert b"PRIVATE" not in response.content
