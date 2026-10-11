"""Mounted allauth code exchange with only external provider HTTP mocked."""

import json
from functools import lru_cache
from urllib.parse import parse_qs, urlsplit

import pytest
import requests
from allauth.socialaccount.internal import statekit
from allauth.socialaccount.models import SocialAccount, SocialToken
from django.contrib.auth import SESSION_KEY
from django.contrib.sessions.models import Session
from django.test import Client, RequestFactory
from django.utils import timezone
from jsonschema import Draft202012Validator

from config.contract import read_contract, resolve
from users.authentication import (
    DENIED_KEY,
    EXPORT_KEY,
    INTENT_KEY,
    PURPOSE_KEY,
    has_fresh_export_auth,
)
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]


@pytest.fixture(autouse=True)
def configured_provider(settings):
    settings.DISCORD_CLIENT_ID = "fictional-client"
    settings.DISCORD_CLIENT_SECRET = "fictional-secret"
    settings.DISCORD_REDIRECT_URI = "http://testserver/api/auth/discord/callback"
    settings.SOCIALACCOUNT_PROVIDERS = {
        "discord": {
            "SCOPE": ["identify"],
            "OAUTH_PKCE_ENABLED": True,
            "APP": {"client_id": "fictional-client", "secret": "fictional-secret"},
        }
    }


@pytest.fixture
def member():
    return User.objects.create_user(
        "12345678901234567",
        display_name="Luna nativa",
        bio="Native bio",
        favourite_quote="Native quote",
        avatar_path="/media/avatars/native.webp",
        approved=True,
    )


@pytest.fixture
def provider_http(monkeypatch, member):
    config = {
        "profile": {
            "id": member.discord_user_id,
            "username": "Provider name",
            "email": "fictional@example.invalid",
            "avatar": "provider-avatar",
        },
        "token": {
            "access_token": "secret-access-sentinel",
            "refresh_token": "secret-refresh",
        },
        "calls": [],
    }

    def send(self, method, url, **kwargs):
        config["calls"].append((method, url, kwargs))
        if config.get("failure"):
            raise requests.ConnectionError("secret-provider-error-sentinel")
        response = requests.Response()
        response.status_code = config.get("status", 200)
        response.headers["content-type"] = "application/json"
        payload = config["token"] if method == "POST" else config["profile"]
        response._content = json.dumps(payload).encode()
        return response

    monkeypatch.setattr(requests.sessions.Session, "request", send)
    return config


@lru_cache
def validator(path, method, status):
    contract = read_contract()
    response = resolve(
        contract, contract["paths"][path][method]["responses"][str(status)]
    )
    return response


def check(response, path, method="get", status=200):
    assert response.status_code == status
    assert response.headers["Cache-Control"] == "no-store"
    declared = validator(path, method, status)
    if "content" in declared:
        Draft202012Validator(
            declared["content"]["application/json"]["schema"]
        ).validate(response.json())
    else:
        assert response.content == b""
    if status == 302:
        assert response["Location"]
    for secret in [
        b"secret-access-sentinel",
        b"secret-refresh",
        b"secret-provider-error",
    ]:
        assert secret not in response.content
        assert secret.decode() not in str(dict(response.headers))
    return response


def start(client, purpose="login", **query):
    response = check(
        client.get("/api/auth/discord/start", {"purpose": purpose, **query}),
        "/api/auth/discord/start",
        status=302,
    )
    params = parse_qs(urlsplit(response["Location"]).query)
    assert params["scope"] == ["identify"]
    assert params["redirect_uri"] == ["http://testserver/api/auth/discord/callback"]
    assert params["code_challenge_method"] == ["S256"]
    return params["state"][0]


def finish(client, state, **query):
    return check(
        client.get(
            "/api/auth/discord/callback",
            {"state": state, "code": "fresh-code", **query},
        ),
        "/api/auth/discord/callback",
        status=302,
    )


def projection(client):
    response = check(client.get("/api/session"), "/api/session")
    assert response.cookies["csrftoken"].value
    return response.json()


def freshness(client):
    request = RequestFactory().get("/api/session")
    request.session = client.session
    identity = client.session.get(SESSION_KEY)
    from django.contrib.auth.models import AnonymousUser

    request.user = User.objects.filter(pk=identity).first() or AnonymousUser()
    return has_fresh_export_auth(request)


@pytest.mark.parametrize("role", ["member", "admin"])
def test_real_callback_approved_identity_native_profile_and_rotation(
    client, member, provider_http, role
):
    member.role = role
    member.save()
    before = {
        key: getattr(member, key)
        for key in ["display_name", "bio", "favourite_quote", "avatar_path", "role"]
    }
    assert projection(client) == {"status": "anonymous", "demoSignInAvailable": False}
    state = start(
        client,
        scope="email,guilds",
        next="https://evil.invalid",
        auth_params="scope=email",
    )
    old_cookie = client.cookies["sessionid"].value
    assert finish(client, state)["Location"] == "/"
    assert client.cookies["sessionid"].value != old_cookie
    assert not Session.objects.filter(session_key=old_cookie).exists()
    assert projection(client) == {
        "status": "signedIn",
        "user": {
            "id": str(member.pk),
            "displayName": "Luna nativa",
            "avatarUrl": "/media/avatars/native.webp",
            "role": role,
        },
    }
    member.refresh_from_db()
    assert before == {key: getattr(member, key) for key in before}
    assert User.objects.count() == 1
    assert not SocialAccount.objects.exists() and not SocialToken.objects.exists()
    assert not freshness(client)
    assert len(provider_http["calls"]) == 2
    token_call = provider_http["calls"][0]
    assert token_call[2]["data"]["code"] == "fresh-code"
    assert token_call[2]["data"]["code_verifier"]
    assert "secret-access-sentinel" not in str(client.session.items())


@pytest.mark.parametrize(
    "condition",
    [
        "unknown",
        "unapproved",
        "revoked",
        "integer",
        "unicode",
        "newline",
        "missing",
        "list",
    ],
)
def test_refused_provider_identity_never_creates_user(
    client, member, provider_http, condition
):
    if condition == "unknown":
        provider_http["profile"]["id"] = "9" * 17
    elif condition in {"unapproved", "revoked"}:
        member.approved = False
        member.revoked_at = timezone.now() if condition == "revoked" else None
        member.save()
    elif condition == "missing":
        provider_http["profile"] = {}
    elif condition == "list":
        provider_http["profile"] = []
    else:
        provider_http["profile"]["id"] = {
            "integer": int(member.discord_user_id),
            "unicode": "١" * 17,
            "newline": member.discord_user_id + "\n",
        }[condition]
    assert finish(client, start(client))["Location"] == "/"
    assert projection(client) == {"status": "denied", "demoSignInAvailable": False}
    assert projection(client)["status"] == "denied"
    assert SESSION_KEY not in client.session
    assert User.objects.count() == 1 and not SocialToken.objects.exists()
    start(client)
    assert projection(client)["status"] == "anonymous"


@pytest.mark.parametrize(
    "failure",
    [
        "missing",
        "mismatch",
        "expired",
        "future",
        "refused",
        "network",
        "bad_token",
        "bad_profile",
        "provider_500",
    ],
)
def test_failed_exchange_or_state_is_safe_and_consumed(
    client, member, provider_http, monkeypatch, caplog, failure
):
    state = start(client)
    if failure in {"expired", "future"}:
        server_session = client.session
        states = server_session[statekit.STATES_SESSION_KEY]
        if failure == "expired":
            states[state][1] -= 601
        else:
            states[state][0]["data"]["issued"] += 60
        server_session[statekit.STATES_SESSION_KEY] = states
        server_session.save()
    if failure == "network":
        provider_http["failure"] = True
    if failure == "bad_token":
        provider_http["token"] = {"error": "secret-provider-error"}
    if failure == "bad_profile":
        provider_http["profile"] = None
    if failure == "provider_500":
        provider_http["status"] = 500
    if failure == "missing":
        response = check(
            client.get("/api/auth/discord/callback", {"code": "fresh-code"}),
            "/api/auth/discord/callback",
            status=302,
        )
    else:
        response = finish(
            client,
            "wrong-state" if failure == "mismatch" else state,
            **({"error": "access_denied"} if failure == "refused" else {}),
        )
    assert response["Location"] == "/"
    assert projection(client)["status"] == "denied"
    calls = len(provider_http["calls"])
    finish(client, state)
    assert len(provider_http["calls"]) == calls
    assert SESSION_KEY not in client.session
    assert "secret-provider-error" not in caplog.text


def test_browser_bound_state_cannot_authenticate_another_browser(client, provider_http):
    state = start(client)
    other = Client()
    finish(other, state)
    assert projection(other)["status"] == "denied"
    assert provider_http["calls"] == []
    finish(client, state)
    assert projection(client)["status"] == "signedIn"


@pytest.mark.parametrize("change", ["revoked", "unapproved", "deleted"])
def test_session_rechecks_database_flushes_and_prevents_replay(
    client, member, provider_http, change
):
    finish(client, start(client))
    old_cookie = client.cookies["sessionid"].value
    if change == "deleted":
        member.delete()
    else:
        member.approved = False
        member.revoked_at = timezone.now() if change == "revoked" else None
        member.save()
    assert projection(client) == {"status": "anonymous", "demoSignInAvailable": False}
    assert not Session.objects.filter(session_key=old_cookie).exists()
    if change != "deleted":
        member.approved, member.revoked_at = True, None
        member.save()
    client.cookies["sessionid"] = old_cookie
    assert projection(client)["status"] == "anonymous"


@pytest.mark.parametrize("purpose", ["invalid", "https://evil.invalid", ""])
def test_invalid_purpose_never_initiates_oauth(client, provider_http, purpose):
    response = check(
        client.get("/api/auth/discord/start", {"purpose": purpose}),
        "/api/auth/discord/start",
        status=302,
    )
    assert response["Location"] == "/" and not provider_http["calls"]
    assert statekit.STATES_SESSION_KEY not in client.session


def test_credentials_absent_boot_health_session_and_safe_start(client, settings):
    settings.DISCORD_CLIENT_ID = ""
    settings.DISCORD_CLIENT_SECRET = ""
    assert client.get("/api/health").status_code == 200
    assert projection(client)["status"] == "anonymous"
    assert (
        check(
            client.get("/api/auth/discord/start"), "/api/auth/discord/start", status=503
        ).json()["code"]
        == "service_unavailable"
    )


def test_export_start_requires_current_admin_without_provider_calls(
    client, member, provider_http
):
    assert (
        check(
            client.get("/api/auth/discord/start?purpose=export"),
            "/api/auth/discord/start",
            status=302,
        )["Location"]
        == "/"
    )
    finish(client, start(client))
    provider_http["calls"].clear()
    assert (
        check(
            client.get("/api/auth/discord/start?purpose=export"),
            "/api/auth/discord/start",
            status=302,
        )["Location"]
        == "/administracion"
    )
    assert provider_http["calls"] == []


@pytest.mark.parametrize(
    "failure",
    [None, "different", "refused", "network", "mismatch", "expired", "role", "revoked"],
)
def test_export_callback_same_admin_only_preserves_session_on_failure(
    client, member, provider_http, failure
):
    member.role = "admin"
    member.save()
    finish(client, start(client))
    cookie = client.cookies["sessionid"].value
    assert not freshness(client)
    state = start(client, "export")
    if failure == "different":
        other = User.objects.create_user(
            "9" * 17, display_name="Otra", approved=True, role="admin"
        )
        provider_http["profile"]["id"] = other.discord_user_id
    if failure == "network":
        provider_http["failure"] = True
    if failure == "expired":
        server_session = client.session
        server_session[statekit.STATES_SESSION_KEY][state][1] -= 601
        server_session.save()
    if failure in {"role", "revoked"}:
        if failure == "role":
            member.role = "member"
        else:
            member.approved, member.revoked_at = False, timezone.now()
        member.save()
    response = finish(
        client,
        "bad-state" if failure == "mismatch" else state,
        **({"error": "access_denied"} if failure == "refused" else {}),
    )
    assert response["Location"] == ("/" if failure == "revoked" else "/administracion")
    if failure == "revoked":
        assert projection(client)["status"] == "anonymous"
    else:
        assert projection(client)["user"]["id"] == str(member.pk)
        assert client.cookies["sessionid"].value == cookie
    assert freshness(client) is (failure is None)
    assert not SocialAccount.objects.exists() and not SocialToken.objects.exists()
    if failure is None:
        calls = len(provider_http["calls"])
        finish(client, state)
        assert len(provider_http["calls"]) == calls
        assert not freshness(client)
        assert projection(client)["user"]["id"] == str(member.pk)


@pytest.mark.parametrize("age,expected", [(299, True), (300, False), (-1, False)])
def test_server_export_freshness_boundaries(
    client, member, provider_http, monkeypatch, age, expected
):
    member.role = "admin"
    member.save()
    finish(client, start(client))
    finish(client, start(client, "export"))
    authenticated_at = timezone.now()
    server_session = client.session
    server_session[EXPORT_KEY]["at"] = authenticated_at.timestamp()
    server_session.save()
    from datetime import timedelta

    monkeypatch.setattr(
        timezone, "now", lambda: authenticated_at + timedelta(seconds=age)
    )
    assert freshness(client) is expected


def test_ordinary_login_rotates_existing_identity_and_clears_export_authority(
    client, member, provider_http
):
    member.role = "admin"
    member.save()
    finish(client, start(client))
    finish(client, start(client, "export"))
    assert freshness(client)
    previous = client.cookies["sessionid"].value
    finish(client, start(client))
    assert client.cookies["sessionid"].value != previous
    assert not Session.objects.filter(session_key=previous).exists()
    assert not freshness(client)


def test_export_freshness_invalidated_by_discord_identity_replacement(
    client, member, provider_http
):
    member.role = "admin"
    member.save()
    finish(client, start(client))
    finish(client, start(client, "export"))
    assert freshness(client)
    cookie = client.cookies["sessionid"].value
    cached_identity = User.objects.get(pk=member.pk)
    member.discord_user_id = "98765432109876543"
    member.save()

    request = RequestFactory().get("/api/session")
    request.session = client.session
    request.user = cached_identity
    assert not has_fresh_export_auth(request)
    assert EXPORT_KEY not in request.session
    request.session.save()
    assert EXPORT_KEY not in client.session
    assert projection(client)["user"]["id"] == str(member.pk)
    assert client.cookies["sessionid"].value == cookie


def test_logout_clears_all_server_authentication_markers(client, member, provider_http):
    member.role = "admin"
    member.save()
    finish(client, start(client))
    finish(client, start(client, "export"))
    start(client, "export")
    server_session = client.session
    server_session[EXPORT_KEY] = {
        "id": str(member.pk),
        "at": timezone.now().timestamp(),
    }
    server_session[DENIED_KEY] = True
    server_session.save()
    check(client.post("/api/auth/logout"), "/api/auth/logout", "post", 204)
    assert all(
        key not in client.session
        for key in [
            SESSION_KEY,
            EXPORT_KEY,
            DENIED_KEY,
            INTENT_KEY,
            PURPOSE_KEY,
            statekit.STATES_SESSION_KEY,
        ]
    )


def test_export_state_expires_at_exactly_ten_minutes(
    client, member, provider_http, monkeypatch
):
    member.role = "admin"
    member.save()
    finish(client, start(client))
    now = timezone.now()
    monkeypatch.setattr(timezone, "now", lambda: now)
    state = start(client, "export")
    from datetime import timedelta

    monkeypatch.setattr(timezone, "now", lambda: now + timedelta(seconds=600))
    calls = len(provider_http["calls"])
    assert finish(client, state)["Location"] == "/administracion"
    assert len(provider_http["calls"]) == calls
    assert projection(client)["status"] == "signedIn" and not freshness(client)


@pytest.mark.parametrize("authenticated", [False, True])
def test_csrf_logout_idempotent_flush_and_origin(
    client, member, provider_http, authenticated
):
    browser = Client(enforce_csrf_checks=True)
    if authenticated:
        finish(browser, start(browser))
    token = browser.get("/api/session").cookies["csrftoken"].value
    cookie = browser.cookies.get("sessionid")
    old_cookie = cookie.value if cookie else None
    for headers in [
        {},
        {"HTTP_X_CSRFTOKEN": "bad"},
        {"HTTP_X_CSRFTOKEN": token, "HTTP_ORIGIN": "https://evil.invalid"},
    ]:
        check(
            browser.post("/api/auth/logout", **headers), "/api/auth/logout", "post", 403
        )
        assert projection(browser)["status"] == (
            "signedIn" if authenticated else "anonymous"
        )
    check(
        browser.post(
            "/api/auth/logout", HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="http://testserver"
        ),
        "/api/auth/logout",
        "post",
        204,
    )
    check(
        browser.post("/api/auth/logout", HTTP_X_CSRFTOKEN=token),
        "/api/auth/logout",
        "post",
        204,
    )
    assert projection(browser)["status"] == "anonymous"
    if old_cookie:
        assert not Session.objects.filter(session_key=old_cookie).exists()
        browser.cookies["sessionid"] = old_cookie
        assert projection(browser)["status"] == "anonymous"


def test_get_cannot_logout_and_no_allauth_management_routes(
    client, member, provider_http
):
    finish(client, start(client))
    assert client.get("/api/auth/logout").status_code == 405
    assert projection(client)["status"] == "signedIn"
    for path in [
        "/accounts/login/",
        "/accounts/signup/",
        "/accounts/discord/login/",
        "/accounts/discord/login/callback/",
    ]:
        assert Client().get(path).status_code == 401
        assert client.get(path).status_code == 404
