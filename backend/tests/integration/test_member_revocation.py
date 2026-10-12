"""Mounted revocation, persisted authorization and database-session guarantees."""

from functools import lru_cache

import pytest
from django.contrib.sessions.models import Session
from django.test import Client
from django.utils import timezone
from jsonschema import Draft202012Validator, FormatChecker

from config.contract import read_contract, resolve
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
PATH = "/api/admin/members/{memberId}/revoke"


@pytest.fixture
def identities():
    return [
        User.objects.create_user(
            f"1000000000000000{number:02d}",
            display_name=name,
            approved=True,
            role="admin" if number == 1 else "member",
            bio="private-bio-sentinel",
            favourite_quote="private-quote-sentinel",
            avatar_path=f"/media/avatars/fictional-{number}.webp",
        )
        for number, name in enumerate(["Olivia", "Álvaro", "Nora"], start=1)
    ]


def browser(identity=None):
    client = Client(enforce_csrf_checks=True)
    if identity:
        client.force_login(identity)
    client.get("/api/session")
    return client


def revoke(client, target, csrf=True, **kwargs):
    if csrf:
        kwargs["HTTP_X_CSRFTOKEN"] = client.cookies["csrftoken"].value
    target, separator, query = str(target).partition("?")
    return client.post(PATH.format(memberId=target) + separator + query, **kwargs)


@lru_cache
def validator(status):
    contract = read_contract()
    schema = resolve(
        contract, contract["paths"][PATH]["post"]["responses"][str(status)]
    )["content"]["application/json"]["schema"]
    return Draft202012Validator(schema, format_checker=FormatChecker())


def check(response, status):
    assert response.status_code == status
    assert response.headers["Content-Type"].split(";")[0] == "application/json"
    assert "Location" not in response.headers
    validator(status).validate(response.json())
    if status != 200:
        assert response.json() == {
            "code": {
                401: "unauthenticated",
                403: "forbidden",
                404: "not_found",
                409: "conflict",
                500: "internal_error",
            }[status],
            "message": {
                401: "Debes iniciar sesión.",
                403: "No tienes permiso para esta acción.",
                404: "No se ha encontrado.",
                409: "La acción no está disponible en este estado.",
                500: "Ha ocurrido un error. Inténtalo de nuevo.",
            }[status],
        }
    for secret in [
        b"private-bio-sentinel",
        b"private-quote-sentinel",
        b"exception-secret",
    ]:
        assert secret not in response.content
    return response.json()


def snapshot():
    return list(User.objects.order_by("pk").values()), list(
        Session.objects.order_by("session_key").values()
    )


@pytest.mark.parametrize("state", ["anonymous", "pending", "revoked", "deleted"])
@pytest.mark.parametrize("target", ["known", "missing", "opaque"])
def test_ineligible_caller_is_refused_before_target_lookup(identities, state, target):
    admin, member, _ = identities
    client = browser(None if state == "anonymous" else admin)
    if state == "deleted":
        admin.delete()
    elif state != "anonymous":
        User.objects.filter(pk=admin.pk).update(
            approved=False, revoked_at=timezone.now() if state == "revoked" else None
        )
    before = list(User.objects.order_by("pk").values())
    target = (
        str(member.pk)
        if target == "known"
        else "999999"
        if target == "missing"
        else "opaque"
    )
    check(revoke(client, target, csrf=False), 401)
    assert list(User.objects.order_by("pk").values()) == before


@pytest.mark.parametrize("target", ["known", "missing", "opaque", "own"])
@pytest.mark.parametrize("claims", ["body", "query", "session"])
def test_member_and_curator_claims_cannot_grant_admin_permission(
    identities, target, claims
):
    _, member, other = identities
    client = browser(member)
    target = (
        str(other.pk)
        if target == "known"
        else str(member.pk)
        if target == "own"
        else target
    )
    data = {"role": "admin", "approved": True, "isCurator": True, "userId": "1"}
    kwargs = {}
    if claims == "body":
        kwargs.update(data=data, content_type="application/json")
    elif claims == "query":
        target += "?role=admin&approved=true&isCurator=true"
    else:
        session = client.session
        session.update(data)
        session.save()
    before = snapshot()
    check(revoke(client, target, **kwargs), 403)
    assert snapshot() == before


@pytest.mark.parametrize("csrf", ["missing", "wrong", "origin"])
def test_admin_requires_valid_csrf_before_any_mutation(identities, csrf):
    admin, member, _ = identities
    client = browser(admin)
    before = snapshot()
    kwargs = {}
    if csrf == "wrong":
        kwargs["HTTP_X_CSRFTOKEN"] = "b" * 32
    if csrf == "origin":
        kwargs.update(HTTP_ORIGIN="https://attacker.invalid")
    check(revoke(client, member.pk, csrf=csrf == "origin", **kwargs), 403)
    assert snapshot() == before


@pytest.mark.parametrize(
    "target", ["missing", "opaque", "huge", "own", "revoked", "pending"]
)
def test_admin_domain_refusals_preserve_every_row_and_session(identities, target):
    admin, member, _ = identities
    client = browser(admin)
    browser(member)
    if target in {"revoked", "pending"}:
        User.objects.filter(pk=member.pk).update(
            approved=False, revoked_at=timezone.now() if target == "revoked" else None
        )
    value = {
        "missing": "999999",
        "opaque": "native-opaque",
        "huge": "9" * 100,
        "own": str(admin.pk),
        "revoked": str(member.pk),
        "pending": str(member.pk),
    }[target]
    before = snapshot()
    check(
        revoke(client, value), 404 if target in {"missing", "opaque", "huge"} else 409
    )
    assert snapshot() == before


def test_success_removes_all_target_sessions_and_old_cookies_never_revive(
    identities, settings
):
    admin, member, other = identities
    acting, first, unused, other_browser = [
        browser(user) for user in [admin, member, member, other]
    ]
    cookies = [client.cookies["sessionid"].value for client in [first, unused]]
    assert len(set(cookies)) == 2
    before = User.objects.get(pk=member.pk).__dict__.copy()
    existing_sessions = {
        row.session_key: row.session_data
        for row in Session.objects.exclude(session_key__in=cookies)
    }
    start = timezone.now()
    check(revoke(acting, member.pk), 200)
    member.refresh_from_db()
    assert not member.approved and start <= member.revoked_at <= timezone.now()
    assert (
        timezone.is_aware(member.revoked_at)
        and member.updated_at > before["updated_at"]
    )
    for field, value in before.items():
        if field not in {"_state", "approved", "revoked_at", "updated_at"}:
            assert getattr(member, field) == value
    assert not Session.objects.filter(session_key__in=cookies).exists()
    assert {
        row.session_key: row.session_data for row in Session.objects.all()
    } == existing_sessions
    assert acting.get("/api/session").json()["user"]["id"] == str(admin.pk)
    assert other_browser.get("/api/session").json()["user"]["id"] == str(other.pk)
    # Test-only probe demonstrates the guard never invokes protected work.
    from tests.integration import guard_urls

    settings.ROOT_URLCONF = "tests.integration.guard_urls"
    guard_urls.invocations.clear()
    check(first.get("/probe/private"), 401)
    assert not guard_urls.invocations
    # The second old browser makes no request during the revoked period.
    User.objects.filter(pk=member.pk).update(approved=True, revoked_at=None)
    for old_client, cookie in zip([first, unused], cookies, strict=True):
        old_client.cookies["sessionid"] = cookie
        check(old_client.get("/probe/private"), 401)
    assert not guard_urls.invocations
    settings.ROOT_URLCONF = "config.urls"
    for old_client, cookie in zip([first, unused], cookies, strict=True):
        old_client.cookies["sessionid"] = cookie
        assert old_client.get("/api/session").json() == {
            "status": "anonymous",
            "demoSignInAvailable": False,
        }


def test_repeat_revocation_preserves_original_revocation_time(identities):
    admin, member, _ = identities
    client = browser(admin)
    check(revoke(client, member.pk), 200)
    before = snapshot()
    check(revoke(client, member.pk), 409)
    assert snapshot() == before


def test_failure_after_session_deletion_rolls_back_both_mutation_and_sessions(
    identities, monkeypatch
):
    from users import membership

    admin, member, _ = identities
    client = browser(admin)
    browsers = [browser(member), browser(member)]
    before = snapshot()
    original = membership.invalidate_member_sessions

    def fail(identity):
        original(identity)
        assert not Session.objects.filter(
            session_key=browsers[0].cookies["sessionid"].value
        ).exists()
        raise RuntimeError("exception-secret provider-token private-text")

    monkeypatch.setattr(membership, "invalidate_member_sessions", fail)
    check(revoke(client, member.pk), 500)
    assert snapshot() == before
    for old_browser in browsers:
        assert old_browser.get("/api/session").json()["user"]["id"] == str(member.pk)


def test_projection_omits_pending_and_uses_native_closed_ordered_rows(identities):
    admin, member, _ = identities
    for number, name, approved, revoked in [
        (4, "Ñora", True, False),
        (5, "Óscar", True, False),
        (6, "Ágata", False, True),
        (7, "Bruna", False, False),
        (8, "alvaro", True, False),
    ]:
        User.objects.create_user(
            f"1000000000000000{number:02d}",
            display_name=name,
            approved=approved,
            revoked_at=timezone.now() if revoked else None,
        )
    result = check(revoke(browser(admin), member.pk), 200)
    assert result["curator"] is None
    assert [row["member"]["displayName"] for row in result["members"]] == [
        "alvaro",
        "Nora",
        "Ñora",
        "Olivia",
        "Óscar",
        "Ágata",
        "Álvaro",
    ]
    for row in result["members"]:
        native = User.objects.get(pk=row["member"]["id"])
        assert row == {
            "member": {
                "id": str(native.pk),
                "displayName": native.display_name,
                "avatarUrl": native.avatar_path or None,
            },
            "discordId": native.discord_user_id,
            "role": native.role,
            "status": "revoked" if native.revoked_at else "active",
            "addedAt": native.created_at.isoformat(timespec="milliseconds").replace(
                "+00:00", "Z"
            ),
            "revokedAt": native.revoked_at.isoformat(timespec="milliseconds").replace(
                "+00:00", "Z"
            )
            if native.revoked_at
            else None,
            "isMe": native.pk == admin.pk,
            "isCurator": False,
        }
