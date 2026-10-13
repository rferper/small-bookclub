"""Native curator cycles do not change roles and end atomically on revocation."""

import json
from datetime import datetime, timedelta, timezone

import pytest
from django.db import IntegrityError, transaction
from django.test import Client
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator

from config.contract import read_contract, resolve
from users.models import CuratorAssignment, User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 13, 12, tzinfo=timezone.utc)
DOC = read_contract()
PATH = "/api/admin/curator"


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setattr(django_timezone, "now", lambda: NOW)
    rows = [
        User.objects.create_user(
            f"1000000000000000{index:02d}",
            approved=index < 4,
            role="admin" if index == 1 else "member",
            display_name=f"Fictional reader {index}",
            revoked_at=NOW if index == 4 else None,
        )
        for index in range(1, 6)
    ]
    return rows


def browser(actor=None):
    client = Client(enforce_csrf_checks=True)
    if actor:
        client.force_login(actor)
    client.get("/api/session")
    return client


def put(client, value, csrf=True):
    return client.put(
        PATH,
        json.dumps(value),
        content_type="application/json",
        **({"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}),
    )


def checked(response, status=200, path=PATH, method="put"):
    assert response.status_code == status, response.content
    data = response.json()
    schema = resolve(DOC, DOC["paths"][path][method]["responses"][str(status)])[
        "content"
    ]["application/json"]["schema"]
    Draft202012Validator(schema).validate(data)
    return data


def test_assignment_replacement_idempotence_dates_and_clear_preserve_cycle_history(
    setup, monkeypatch
):
    admin, member, other, *_ = setup
    client = browser(admin)
    view = checked(put(client, {"memberId": str(member.pk)}))
    assert view["curator"]["id"] == str(member.pk)
    assert sum(row["isCurator"] for row in view["members"]) == 1
    assignment = CuratorAssignment.objects.get(current=True)
    assert assignment.assigned_at == NOW
    monkeypatch.setattr(django_timezone, "now", lambda: NOW + timedelta(days=1))
    checked(put(client, {"memberId": str(member.pk)}))
    assignment.refresh_from_db()
    assert assignment.assigned_at == NOW
    assert CuratorAssignment.objects.count() == 1
    checked(put(client, {"memberId": str(other.pk)}))
    assignment.refresh_from_db()
    assert assignment.current is False and assignment.ended_at == NOW + timedelta(
        days=1
    )
    assert checked(put(client, {"memberId": None}))["curator"] is None
    checked(put(client, {"memberId": None}))
    assert (
        CuratorAssignment.objects.count() == 2
        and not CuratorAssignment.objects.filter(current=True).exists()
    )
    for row in setup:
        row.refresh_from_db()
        assert row.role == ("admin" if row.pk == admin.pk else "member")


@pytest.mark.parametrize(
    "value,status",
    [
        ({}, 400),
        ({"memberId": 1}, 400),
        ({"memberId": ""}, 400),
        ({"memberId": None, "role": "admin"}, 400),
        ({"memberId": "999999"}, 404),
        ({"memberId": "unknown"}, 404),
        ({"memberId": "4"}, 404),
        ({"memberId": "5"}, 404),
    ],
)
def test_bad_target_or_payload_does_not_clear_existing_assignment(setup, value, status):
    admin, member, *_ = setup
    row = CuratorAssignment.objects.create(member=member, assigned_at=NOW)
    checked(put(browser(admin), value), status)
    row.refresh_from_db()
    assert row.current is True and row.ended_at is None


def test_curator_gains_no_admin_power_and_csrf_current_role_checks_apply(setup):
    admin, member, *_ = setup
    checked(put(browser(admin), {"memberId": str(member.pk)}))
    curator = browser(member)
    checked(put(curator, {"memberId": None}), 403)
    checked(curator.get("/api/admin/members"), 403, "/api/admin/members", "get")
    checked(put(browser(), {}), 401)
    client = browser(admin)
    checked(put(client, {"memberId": None}, csrf=False), 403)
    User.objects.filter(pk=admin.pk).update(role="member")
    checked(put(client, {"memberId": None}), 403)
    assert CuratorAssignment.objects.get(current=True).member_id == member.pk


def test_revoke_clears_current_atomically_and_restore_does_not_reassign(
    setup, monkeypatch
):
    admin, member, *_ = setup
    client = browser(admin)
    checked(put(client, {"memberId": str(member.pk)}))
    row = CuratorAssignment.objects.get(current=True)
    member_browser = browser(member)
    from users import membership

    original = membership.invalidate_member_sessions

    def failed(*args):
        raise RuntimeError("PRIVATE_SESSION_FAILURE")

    monkeypatch.setattr(membership, "invalidate_member_sessions", failed)

    def revoke():
        return client.post(
            f"/api/admin/members/{member.pk}/revoke",
            HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
        )

    checked(revoke(), 500, "/api/admin/members/{memberId}/revoke", "post")
    row.refresh_from_db()
    member.refresh_from_db()
    assert row.current is True and member.approved is True
    monkeypatch.setattr(membership, "invalidate_member_sessions", original)
    result = checked(revoke(), 200, "/api/admin/members/{memberId}/revoke", "post")
    assert result["curator"] is None
    row.refresh_from_db()
    assert row.current is False and row.ended_at == NOW
    assert member_browser.get("/api/books").status_code == 401
    restored = client.post(
        f"/api/admin/members/{member.pk}/restore",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert (
        checked(restored, 200, "/api/admin/members/{memberId}/restore", "post")[
            "curator"
        ]
        is None
    )
    assert CuratorAssignment.objects.count() == 1


def test_failed_replacement_rolls_back_and_sql_current_constraints_hold(
    setup, monkeypatch
):
    admin, member, other, *_ = setup
    row = CuratorAssignment.objects.create(member=member, assigned_at=NOW)
    with pytest.raises(IntegrityError), transaction.atomic():
        CuratorAssignment.objects.create(member=other, assigned_at=NOW)
    with pytest.raises(IntegrityError), transaction.atomic():
        CuratorAssignment.objects.filter(pk=row.pk).update(current=False)
    with pytest.raises(IntegrityError), transaction.atomic():
        CuratorAssignment.objects.filter(pk=row.pk).update(
            current=False, ended_at=NOW - timedelta(seconds=1)
        )
    original = CuratorAssignment.save

    def failed(assignment, *args, **kwargs):
        if assignment._state.adding:
            raise RuntimeError("PRIVATE_CREATE_FAILURE")
        return original(assignment, *args, **kwargs)

    monkeypatch.setattr(CuratorAssignment, "save", failed)
    checked(put(browser(admin), {"memberId": str(other.pk)}), 500)
    row.refresh_from_db()
    assert row.current is True and row.ended_at is None
