"""Mounted admin allowlist boundaries, transitions and closed contract results."""

import json
from functools import lru_cache

import pytest
from django.contrib.sessions.models import Session
from django.test import Client
from django.utils import timezone
from jsonschema import Draft202012Validator, FormatChecker

from config.contract import read_contract, resolve
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
BASE = "/api/admin/members"
OPERATIONS = ["list", "add", "restore", "revoke"]


@pytest.fixture
def identities():
    return [
        User.objects.create_user(
            f"1000000000000000{number:02d}",
            display_name=name,
            role="admin" if number == 1 else "member",
            approved=True,
            bio="private-bio-sentinel",
            favourite_quote="private-quote-sentinel",
            avatar_path=f"/media/avatars/fictional-{number}.webp",
        )
        for number, name in enumerate(["Olivia", "Álvaro", "Nora"], 1)
    ]


def browser(identity=None):
    client = Client(enforce_csrf_checks=True)
    if identity:
        client.force_login(identity)
    client.get("/api/session")
    return client


def path(operation, target="opaque"):
    return BASE if operation in {"list", "add"} else f"{BASE}/{target}/{operation}"


def invoke(client, operation, target="opaque", body=None, csrf=True, **headers):
    if operation == "list":
        return client.get(path(operation, target), **headers)
    if csrf:
        headers.setdefault("HTTP_X_CSRFTOKEN", client.cookies["csrftoken"].value)
    return client.post(
        path(operation, target),
        data=json.dumps(body) if body is not None else "{invalid-json",
        content_type="application/json",
        **headers,
    )


@lru_cache
def validator(operation, status):
    document = read_contract()
    contract_path = path(operation, "{memberId}")
    method = "get" if operation == "list" else "post"
    schema = resolve(
        document, document["paths"][contract_path][method]["responses"][str(status)]
    )["content"]["application/json"]["schema"]
    return Draft202012Validator(schema, format_checker=FormatChecker())


def check(response, operation, status):
    assert response.status_code == status, response.content
    assert response.headers["Content-Type"].split(";")[0] == "application/json"
    validator(operation, status).validate(response.json())
    for secret in [
        b"private-bio-sentinel",
        b"private-quote-sentinel",
        b"exception-secret",
    ]:
        assert secret not in response.content
    if status >= 400:
        from users.membership import error_result

        assert response.json() == error_result(status)[1]
    return response.json()


def snapshot():
    return list(User.objects.order_by("pk").values()), list(
        Session.objects.order_by("session_key").values()
    )


@pytest.mark.parametrize("operation", OPERATIONS)
@pytest.mark.parametrize(
    "state",
    ["anonymous", "pending", "revoked", "deleted", "member", "curator", "demoted"],
)
def test_current_persisted_authority_precedes_target_and_malformed_input(
    identities, operation, state, monkeypatch
):
    from users import membership

    admin, member, _ = identities
    identity = member if state in {"member", "curator"} else admin
    client = browser(None if state == "anonymous" else identity)
    session = client.session
    session.update(
        {"role": "admin", "approved": True, "isCurator": True, "userId": str(admin.pk)}
    )
    session.save()
    if state == "deleted":
        admin.delete()
    elif state in {"pending", "revoked"}:
        User.objects.filter(pk=admin.pk).update(
            approved=False, revoked_at=timezone.now() if state == "revoked" else None
        )
    elif state == "demoted":
        User.objects.filter(pk=admin.pk).update(role="member")

    def unexpected(*args):
        raise AssertionError(
            "No target lookup, input validation or projection before authorization"
        )

    monkeypatch.setattr(membership, "new_member_input", unexpected)
    monkeypatch.setattr(membership, "native_member_id", unexpected)
    monkeypatch.setattr(membership, "admin_members_projection", unexpected)
    before = list(User.objects.values())
    response = invoke(
        client,
        operation,
        "999999",
        body={"role": "admin", "approved": True, "isCurator": True},
    )
    check(
        response, operation, 403 if state in {"member", "curator", "demoted"} else 401
    )
    assert list(User.objects.values()) == before


@pytest.mark.parametrize("operation", ["add", "restore", "revoke"])
@pytest.mark.parametrize("csrf", ["missing", "wrong", "origin"])
def test_unsafe_allowlist_operations_require_csrf_and_same_origin(
    identities, operation, csrf
):
    admin, member, _ = identities
    client = browser(admin)
    before = snapshot()
    headers = (
        {"HTTP_X_CSRFTOKEN": "b" * 32}
        if csrf == "wrong"
        else {"HTTP_ORIGIN": "https://attacker.invalid"}
        if csrf == "origin"
        else {}
    )
    check(
        invoke(
            client,
            operation,
            member.pk,
            body={"discordId": "200000000000000001", "displayName": "Alba"},
            csrf=csrf == "origin",
            **headers,
        ),
        operation,
        403,
    )
    assert snapshot() == before


def test_list_projects_only_exact_native_active_and_revoked_members(identities):
    admin, member, _ = identities
    User.objects.filter(pk=member.pk).update(approved=False, revoked_at=timezone.now())
    for number, name, approved in [
        (4, "Ñora", True),
        (5, "Óscar", True),
        (6, "Bruna", False),
        (7, "alvaro", True),
    ]:
        User.objects.create_user(
            f"1000000000000000{number:02d}", display_name=name, approved=approved
        )
    result = check(invoke(browser(admin), "list"), "list", 200)
    assert result["curator"] is None
    assert [row["member"]["displayName"] for row in result["members"]] == [
        "alvaro",
        "Nora",
        "Ñora",
        "Olivia",
        "Óscar",
        "Álvaro",
    ]
    for row in result["members"]:
        native = User.objects.get(pk=row["member"]["id"])
        assert row["discordId"] == native.discord_user_id
        assert row["member"]["avatarUrl"] == (native.avatar_path or None)
        assert row["role"] == native.role
        assert row["isMe"] == (native.pk == admin.pk)
        assert row["isCurator"] is False
        assert set(row) == {
            "member",
            "discordId",
            "role",
            "status",
            "addedAt",
            "revokedAt",
            "isMe",
            "isCurator",
        }
        assert set(row["member"]) == {"id", "displayName", "avatarUrl"}


def test_add_immediately_approves_exact_identity_with_empty_native_profile(identities):
    admin, _, _ = identities
    client = browser(admin)
    result = check(
        invoke(
            client,
            "add",
            body={
                "discordId": "000000000000000001",
                "displayName": " " + "Á" * 40 + " ",
            },
            HTTP_ORIGIN="http://testserver",
        ),
        "add",
        201,
    )
    member = User.objects.get(discord_user_id="000000000000000001")
    assert member.approved and member.revoked_at is None and member.role == "member"
    assert member.display_name == "Á" * 40
    assert (
        member.bio is None
        and member.favourite_quote is None
        and member.avatar_path == ""
    )
    assert not member.has_usable_password() and member.last_login is None
    assert any(
        row["member"]["id"] == str(member.pk) and row["status"] == "active"
        for row in result["members"]
    )


@pytest.mark.parametrize("state", ["active", "revoked", "pending"])
def test_existing_discord_identity_conflicts_before_invalid_other_fields(
    identities, state
):
    admin, member, _ = identities
    if state != "active":
        User.objects.filter(pk=member.pk).update(
            approved=False, revoked_at=timezone.now() if state == "revoked" else None
        )
    client = browser(admin)
    before = snapshot()
    check(
        invoke(
            client,
            "add",
            body={
                "discordId": member.discord_user_id,
                "displayName": "\n",
                "role": "admin",
            },
        ),
        "add",
        409,
    )
    assert snapshot() == before


@pytest.mark.parametrize(
    "body",
    [
        None,
        [],
        "text",
        {},
        {"discordId": "200000000000000001"},
        {"discordId": 200000000000000001, "displayName": "Alba"},
        {"discordId": "２００００００００００００００００１", "displayName": "Alba"},
        {"discordId": " 200000000000000001", "displayName": "Alba"},
        {"discordId": "200000000000000001", "displayName": "Alba\n"},
        {"discordId": "200000000000000001", "displayName": "a" * 41},
        {"discordId": "200000000000000001", "displayName": "Alba", "role": "admin"},
    ],
)
def test_invalid_add_is_safe_400_without_any_row_or_session_mutation(identities, body):
    client = browser(identities[0])
    before = snapshot()
    check(invoke(client, "add", body=body), "add", 400)
    assert snapshot() == before


@pytest.mark.parametrize("state", ["missing", "opaque", "huge", "active", "pending"])
def test_restore_refusals_are_atomic(identities, state):
    admin, member, _ = identities
    if state == "pending":
        User.objects.filter(pk=member.pk).update(approved=False)
    client = browser(admin)
    target = {"missing": "999999", "opaque": "opaque", "huge": "9" * 100}.get(
        state, str(member.pk)
    )
    before = snapshot()
    check(
        invoke(client, "restore", target),
        "restore",
        404 if state in {"missing", "opaque", "huge"} else 409,
    )
    assert snapshot() == before


def test_revoke_then_restore_preserves_profile_role_and_never_revives_idle_cookie(
    identities,
):
    admin, member, _ = identities
    actor, old_browser, idle_browser = browser(admin), browser(member), browser(member)
    cookies = [
        old_browser.cookies["sessionid"].value,
        idle_browser.cookies["sessionid"].value,
    ]
    original = User.objects.filter(pk=member.pk).values().get()
    check(invoke(actor, "revoke", member.pk), "revoke", 200)
    assert old_browser.get("/api/session").json()["status"] == "anonymous"
    restored = check(invoke(actor, "restore", member.pk), "restore", 200)
    member.refresh_from_db()
    assert member.approved and member.revoked_at is None
    for key, value in original.items():
        if key not in {"approved", "revoked_at", "updated_at"}:
            assert getattr(member, key) == value
    assert any(
        row["member"]["id"] == str(member.pk) and row["status"] == "active"
        for row in restored["members"]
    )
    assert not Session.objects.filter(session_key__in=cookies).exists()
    for client, cookie in zip([old_browser, idle_browser], cookies, strict=True):
        client.cookies["sessionid"] = cookie
        assert client.get("/api/session").json()["status"] == "anonymous"


@pytest.mark.parametrize("operation", ["add", "restore"])
def test_projection_failure_rolls_back_allowlist_change_and_sessions(
    identities, operation, monkeypatch
):
    from users import membership

    admin, member, _ = identities
    client = browser(admin)
    if operation == "restore":
        User.objects.filter(pk=member.pk).update(
            approved=False, revoked_at=timezone.now()
        )
    before = snapshot()

    def fail(*args):
        raise RuntimeError("exception-secret provider-token")

    monkeypatch.setattr(membership, "admin_members_projection", fail)
    check(
        invoke(
            client,
            operation,
            member.pk,
            body={"discordId": "200000000000000001", "displayName": "Alba"},
        ),
        operation,
        500,
    )
    assert snapshot() == before
