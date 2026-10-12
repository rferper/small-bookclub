"""Mounted calendar lifecycle with real sessions, SQL and safe response contracts."""

import json
from datetime import datetime, timedelta
from datetime import timezone as datetime_timezone

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import Client
from django.utils import timezone
from jsonschema import Draft202012Validator, FormatChecker

from books.models import Book
from config.contract import read_contract, resolve
from meetings.models import Meeting
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
PATH = "/api/admin/meetings"
NOW = datetime(2026, 1, 15, 12, tzinfo=datetime_timezone.utc)


@pytest.fixture
def identities(monkeypatch, settings):
    settings.TIME_ZONE = "Europe/Madrid"
    monkeypatch.setattr(timezone, "now", lambda: NOW)
    return [
        User.objects.create_user(
            f"1000000000000000{index:02d}",
            display_name=f"Fictional reader {index}",
            role="admin" if index == 1 else "member",
            approved=True,
        )
        for index in [1, 2]
    ]


def browser(identity=None):
    client = Client(enforce_csrf_checks=True)
    if identity:
        client.force_login(identity)
    client.get("/api/session")
    return client


def call(client, method, url=PATH, data=None, *, csrf=True):
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    return client.generic(
        method.upper(),
        url,
        data=json.dumps(data).encode() if data is not None else b"",
        content_type="application/json",
        **headers,
    )


def payload(**changes):
    return {
        "startsAt": "2026-01-15T19:30:00Z",
        "bookId": None,
        "weekId": None,
        **changes,
    }


def result(response, method, status, path=PATH):
    assert response.status_code == status, response.content
    document = read_contract()
    schema = resolve(
        document, document["paths"][path][method]["responses"][str(status)]
    )["content"]["application/json"]["schema"]
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(
        response.json()
    )
    return response.json()


def test_admin_creates_reschedules_cancels_and_uncancels_without_content_changes(
    identities,
):
    client = browser(identities[0])
    book = Book.objects.create(title="Fictional book")
    created = result(
        call(client, "post", data=payload(bookId=str(book.pk))), "post", 201
    )
    url = f"{PATH}/{created['id']}"
    row = Meeting.objects.get(pk=created["id"])
    row.summary_text = "PRIVATE SUMMARY SENTINEL"
    row.attendance_recorded = True
    row.save(update_fields=["summary_text", "attendance_recorded"])
    row.attendees.add(identities[1])
    edited = result(
        call(
            client,
            "put",
            url,
            payload(startsAt="2026-01-14T20:30:00+01:00", bookId=str(book.pk)),
        ),
        "put",
        200,
        PATH + "/{meetingId}",
    )
    assert edited["startsAt"] == "2026-01-14T19:30:00Z" and edited["attendanceEligible"]
    for cancelled in [True, False]:
        changed = result(
            call(client, "put", url + "/cancelled", {"cancelled": cancelled}),
            "put",
            200,
            PATH + "/{meetingId}/cancelled",
        )
        assert changed["cancelled"] is cancelled
        assert changed["attendance"] == [
            {
                "id": str(identities[1].pk),
                "displayName": identities[1].display_name,
                "avatarUrl": None,
            }
        ]
        assert "SENTINEL" not in str(changed)
    row.refresh_from_db()
    assert row.summary_text == "PRIVATE SUMMARY SENTINEL" and row.book_id == book.pk


@pytest.mark.parametrize("identity", [None, 1])
def test_permissions_before_lookup_input_and_shared_preview(identities, identity):
    client = browser(identities[identity] if identity is not None else None)
    status = 401 if identity is None else 403
    for method, suffix, data in [
        ("get", "", None),
        ("post", "", {}),
        ("get", "/unknown", None),
        ("put", "/unknown", {}),
        ("put", "/unknown/cancelled", {}),
        ("delete", "/unknown", None),
    ]:
        assert call(client, method, PATH + suffix, data).status_code == status
    assert (
        client.get("/api/admin/deletion-preview/meeting/unknown").status_code == status
    )
    assert not Meeting.objects.exists()


def test_csrf_unknown_target_and_invalid_input_do_not_write(identities):
    client = browser(identities[0])
    result(call(client, "post", data=payload(), csrf=False), "post", 403)
    assert call(client, "put", PATH + "/unknown", {}).status_code == 404
    for changes in [
        {"startsAt": "bad"},
        {"startsAt": "2026-03-29T02:30:00+01:00"},
        {"startsAt": "2026-10-25T02:30:00+02:00"},
        {"summary_text": "Injected"},
        {"bookId": 5},
        {"weekId": []},
    ]:
        result(call(client, "post", data=payload(**changes)), "post", 400)
    for changes in [{"bookId": "unknown"}, {"weekId": "unknown"}]:
        result(call(client, "post", data=payload(**changes)), "post", 404)
    assert not Meeting.objects.exists()


def test_calendar_partition_order_choices_and_exact_now_boundary(identities):
    client = browser(identities[0])
    rows = [
        Meeting.objects.create(
            starts_at=NOW + timedelta(days=offset),
            cancelled=offset == 1,
            summary_text="HIDDEN TEXT",
        )
        for offset in [2, -2, 1, -1, 0]
    ]
    data = result(client.get(PATH), "get", 200)
    assert [row["id"] for row in data["upcoming"]] == [
        str(rows[4].pk),
        str(rows[2].pk),
        str(rows[0].pk),
    ]
    assert [row["id"] for row in data["past"]] == [
        str(rows[3].pk),
        str(rows[1].pk),
    ]
    assert data["upcoming"][0]["attendanceEligible"] is False
    assert data["weeks"] == [] and "HIDDEN" not in str(data)
    assert set(data) == {
        "clubTimezone",
        "upcoming",
        "past",
        "books",
        "weeks",
        "activeMembers",
    }
    assert data["clubTimezone"] == "Europe/Madrid"


def test_removed_book_link_is_preserved_only_for_existing_association(identities):
    client = browser(identities[0])
    book = Book.objects.create(title="Removed fictional")
    row = Meeting.objects.create(starts_at=NOW, book=book)
    book.soft_delete(identities[0])
    assert result(client.get(PATH), "get", 200)["books"] == []
    edited = result(
        call(client, "put", f"{PATH}/{row.pk}", payload(bookId=str(book.pk))),
        "put",
        200,
        PATH + "/{meetingId}",
    )
    assert edited["bookId"] == str(book.pk)
    result(call(client, "post", data=payload(bookId=str(book.pk))), "post", 404)


def test_soft_delete_response_and_preview_never_contain_private_records(identities):
    client = browser(identities[0])
    row = Meeting.objects.create(
        starts_at=NOW, summary_text="PRIVATE SENTINEL", summary_published=True
    )
    row.attendees.add(identities[1])
    preview = result(
        client.get(f"/api/admin/deletion-preview/meeting/{row.pk}"),
        "get",
        200,
        "/api/admin/deletion-preview/{type}/{id}",
    )
    assert preview["dependencies"] == ["1 registros de asistencia conservados"]
    assert "SENTINEL" not in str(preview)
    removed = result(
        call(client, "delete", f"{PATH}/{row.pk}"), "delete", 200, PATH + "/{meetingId}"
    )
    assert len(removed) == 1 and removed[0]["type"] == "meeting"
    assert removed[0]["purgeDueAt"] == (NOW + timedelta(days=30)).isoformat().replace(
        "+00:00", "Z"
    )
    assert "SENTINEL" not in str(removed)
    retained = Meeting.all_objects.get(pk=row.pk)
    assert (
        retained.summary_text == "PRIVATE SENTINEL" and retained.attendees.count() == 1
    )
    assert not Meeting.objects.exists()
    assert (
        call(client, "delete", f"{PATH}/{row.pk}").status_code
        == client.get(f"{PATH}/{row.pk}").status_code
        == 404
    )


def test_failed_delete_projection_rolls_back_removal(identities, monkeypatch):
    from meetings import calendar

    client = browser(identities[0])
    row = Meeting.objects.create(starts_at=NOW)

    def fail():
        raise OSError("PRIVATE FAILURE")

    monkeypatch.setattr(calendar, "bin_projection", fail)
    response = call(client, "delete", f"{PATH}/{row.pk}")
    assert response.status_code == 500 and "PRIVATE" not in str(response.json())
    row.refresh_from_db()
    assert row.deleted_at is None and Meeting.objects.count() == 1


def test_model_naive_datetime_and_sql_empty_publication_are_refused():
    with pytest.raises(ValidationError):
        Meeting(starts_at=datetime(2026, 1, 1)).full_clean()
    with pytest.raises(IntegrityError), transaction.atomic():
        Meeting.objects.bulk_create([Meeting(starts_at=NOW, summary_published=True)])
