"""Real middleware boundaries on disposable SQLite, including denied responses."""

from datetime import timedelta

import pytest
from django.db import OperationalError
from django.test import Client
from django.utils import timezone
from jsonschema import Draft202012Validator

from config.contract import read_contract, resolve
from config.security import consume_budget
from core.models import RequestBudget
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]


def test_public_private_and_error_responses_are_not_cached_or_indexed(client):
    for path in ["/api/health", "/api/session", "/api/me/profile", "/missing"]:
        response = client.get(path)
        assert response["X-Robots-Tag"] == "noindex, nofollow, noarchive"
        assert response["Cache-Control"] == "no-store"
        assert response["X-Frame-Options"] == "DENY"
        assert response["X-Content-Type-Options"] == "nosniff"
        assert response["Referrer-Policy"] == "no-referrer"


def test_https_redirect_hsts_and_secure_cookies(client, settings):
    settings.SECURE_SSL_REDIRECT = True
    settings.SECURE_HSTS_SECONDS = 3600
    settings.SESSION_COOKIE_SECURE = True
    settings.CSRF_COOKIE_SECURE = True
    settings.DISCORD_CLIENT_ID = "fictional-client"
    settings.DISCORD_CLIENT_SECRET = "fictional-secret"
    settings.DISCORD_REDIRECT_URI = "https://testserver/api/auth/discord/callback"
    assert client.get("/api/health").url == "https://testserver/api/health"
    response = client.get("/api/session", secure=True)
    assert response["Strict-Transport-Security"] == "max-age=3600"
    assert response.cookies["csrftoken"]["secure"]
    assert response.cookies["csrftoken"]["samesite"] == "Lax"
    member = User.objects.create_user(
        "100000000000000001", display_name="Persona ficticia", approved=True
    )
    client.force_login(member)
    # OAuth start modifies the session even without configured credentials.
    response = client.get("/api/auth/discord/start", secure=True)
    assert response.cookies["sessionid"]["secure"]
    assert response.cookies["sessionid"]["httponly"]
    assert response.cookies["sessionid"]["samesite"] == "Lax"


def test_forwarded_https_is_untrusted_by_default(client, settings):
    settings.SECURE_SSL_REDIRECT = True
    settings.SECURE_PROXY_SSL_HEADER = None
    assert client.get("/api/health", HTTP_X_FORWARDED_PROTO="https").status_code == 301
    settings.SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    assert client.get("/api/health", HTTP_X_FORWARDED_PROTO="https").status_code == 200


def test_oauth_budget_survives_cookie_and_forwarded_ip_changes(client):
    for index in range(30):
        client.cookies.clear()
        assert (
            client.get(
                "/api/auth/discord/start", HTTP_X_FORWARDED_FOR=f"192.0.2.{index}"
            ).status_code
            == 503
        )
    response = Client().get("/api/auth/discord/callback?code=private&state=private")
    assert response.status_code == 429
    assert 1 <= int(response["Retry-After"]) <= 60
    document = read_contract()
    Draft202012Validator(
        resolve(document, document["components"]["schemas"]["Error"])
    ).validate(response.json())
    budget = RequestBudget.objects.get()
    assert budget.count == 30 and len(budget.key) == 40
    assert "192.0.2" not in budget.key and "private" not in response.content.decode()
    assert Client(REMOTE_ADDR="192.0.2.50").get("/api/session").status_code == 200


def test_budget_expires_at_deadline_and_storage_errors_fail_closed(monkeypatch, client):
    now = timezone.now()
    monkeypatch.setattr(timezone, "now", lambda: now)
    assert consume_budget("fictional", 1) is None
    assert consume_budget("fictional", 1) == 60
    monkeypatch.setattr(timezone, "now", lambda: now + timedelta(seconds=60))
    assert consume_budget("fictional", 1) is None
    assert RequestBudget.objects.count() == 1

    def unavailable(*args):
        raise OperationalError("private details")

    monkeypatch.setattr("config.security.consume_budget", unavailable)
    response = client.get("/api/session")
    assert response.status_code == 503 and b"private" not in response.content
    assert client.get("/api/health").status_code == 200


def test_expensive_routes_share_member_budget_and_revocation_still_wins():
    member = User.objects.create_user(
        "100000000000000001", display_name="Persona ficticia", approved=True
    )
    client = Client()
    client.force_login(member)
    for _ in range(20):
        assert client.get("/api/statistics").status_code == 200
    assert client.get("/api/statistics/compatibility").status_code == 429
    member.revoked_at = timezone.now()
    member.approved = False
    member.save()
    assert client.get("/api/statistics").status_code == 401
    assert Client().get("/api/statistics").status_code == 401


def test_export_budget_stops_before_csrf_or_archive_work(client):
    member = User.objects.create_user(
        "100000000000000001", display_name="Persona ficticia", approved=True
    )
    client = Client(enforce_csrf_checks=True)
    client.force_login(member)
    for _ in range(2):
        assert client.post("/api/admin/export").status_code == 403
    assert client.post("/api/admin/export").status_code == 429
