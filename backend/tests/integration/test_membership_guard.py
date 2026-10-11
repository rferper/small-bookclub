from functools import lru_cache

import pytest
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY
from django.contrib.sessions.models import Session
from django.test import Client
from django.utils import timezone
from jsonschema import Draft202012Validator

from config.contract import read_contract, resolve
from tests.integration import guard_urls
from users.access import PUBLIC_OPERATIONS
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]


@pytest.fixture(autouse=True)
def isolated_routes(settings):
    settings.ROOT_URLCONF = "tests.integration.guard_urls"
    guard_urls.invocations.clear()


@pytest.fixture
def identity():
    return User.objects.create_user(
        "12345678901234567", display_name="Luna", approved=True
    )


@lru_cache
def error_validator(status):
    contract = read_contract()
    schema = contract["components"]["responses"][f"Error{status}"]["content"][
        "application/json"
    ]["schema"]
    return Draft202012Validator(resolve(contract, schema))


def assert_closed_error(response, status):
    assert response.status_code == status
    expected = (
        {"code": "unauthenticated", "message": "Debes iniciar sesión."}
        if status == 401
        else {"code": "forbidden", "message": "No tienes permiso para esta acción."}
    )
    assert response.json() == expected
    assert response.headers["Content-Type"].split(";")[0] == "application/json"
    assert "Location" not in response.headers
    assert b"fictional-secret-sentinel" not in response.content
    assert b"request-secret" not in response.content
    assert not guard_urls.invocations
    assert not response.cookies or all(
        not cookie.value for cookie in response.cookies.values()
    )
    error_validator(status).validate(response.json())


@pytest.mark.parametrize(
    "path",
    [
        "/probe/private",
        "/missing",
        "/admin/",
        "/api/docs",
        "/api/openapi.json",
        "/media/private",
        "/static/private",
        "/probe/slash",
        "/probe/api/typed?number=bad&request-secret=yes",
        "/missing?next=/api/health",
    ],
)
@pytest.mark.parametrize(
    "method", ["get", "post", "put", "patch", "delete", "head", "options"]
)
def test_anonymous_is_refused_before_lookup_validation_redirect_and_csrf(path, method):
    response = getattr(Client(enforce_csrf_checks=True), method)(path)
    if method == "head":
        assert response.status_code == 401
        assert not response.content and not guard_urls.invocations
    else:
        assert_closed_error(response, 401)


@pytest.mark.parametrize("role", ["member", "admin"])
def test_eligible_identity_reaches_new_private_handler(identity, role):
    identity.role = role
    identity.save()
    client = Client(enforce_csrf_checks=True)
    client.force_login(identity)
    assert client.get("/probe/private").json() == {
        "private": "fictional-secret-sentinel"
    }
    assert guard_urls.invocations == ["/probe/private"]


@pytest.mark.parametrize("change", ["pending", "revoked", "deleted"])
def test_next_request_rechecks_row_and_invalidates_session_cookie(identity, change):
    client = Client(enforce_csrf_checks=True)
    client.force_login(identity)
    assert client.get("/probe/private").status_code == 200
    old_cookie = client.cookies["sessionid"].value
    guard_urls.invocations.clear()
    if change == "deleted":
        identity.delete()
    else:
        User.objects.filter(pk=identity.pk).update(
            approved=False, revoked_at=timezone.now() if change == "revoked" else None
        )
    assert_closed_error(client.post("/probe/private"), 401)
    assert not Session.objects.filter(session_key=old_cookie).exists()
    if change != "deleted":
        User.objects.filter(pk=identity.pk).update(approved=True, revoked_at=None)
    client.cookies["sessionid"] = old_cookie
    assert_closed_error(client.get("/probe/private"), 401)


@pytest.mark.parametrize("role", ["member", "admin"])
@pytest.mark.parametrize("revoked", [False, True])
def test_initial_ineligible_session_is_refused(identity, role, revoked):
    identity.role = role
    identity.approved = False
    identity.revoked_at = timezone.now() if revoked else None
    identity.save()
    client = Client()
    client.force_login(identity)
    assert_closed_error(client.get("/probe/private"), 401)


@pytest.mark.parametrize("cookie", ["invalid-cookie", "0" * 32])
def test_invalid_cookie_does_not_reach_handler(cookie):
    client = Client()
    client.cookies["sessionid"] = cookie
    assert_closed_error(client.get("/probe/private"), 401)


def test_unknown_identity_in_real_server_session_is_refused():
    client = Client()
    session = client.session
    session.update(
        {
            SESSION_KEY: "999999",
            BACKEND_SESSION_KEY: "django.contrib.auth.backends.ModelBackend",
            HASH_SESSION_KEY: "stale",
        }
    )
    session.save()
    client.cookies["sessionid"] = session.session_key
    assert_closed_error(client.get("/probe/private"), 401)
    assert not Session.objects.filter(session_key=session.session_key).exists()


@pytest.mark.parametrize("method,path", sorted(PUBLIC_OPERATIONS))
def test_exact_public_probe_with_query_waives_only_membership(method, path):
    client = Client(enforce_csrf_checks=True)
    if method == "POST":
        assert_closed_error(client.post(path + "?request-secret=yes"), 403)
        client.cookies["csrftoken"] = "a" * 32
        response = client.post(path + "?request-secret=yes", HTTP_X_CSRFTOKEN="a" * 32)
    else:
        response = client.get(path + "?request-secret=yes")
    assert response.status_code == 200
    assert not response.cookies


@pytest.mark.parametrize("method,path", sorted(PUBLIC_OPERATIONS))
def test_public_paths_do_not_exempt_variants_or_other_methods(method, path):
    client = Client(enforce_csrf_checks=True)
    for variant in [path + "/", path + "extra", path + "/secret", "/prefix" + path]:
        assert_closed_error(client.generic(method, variant), 401)
    for alternative in {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"} - {method}:
        assert_closed_error(client.generic(alternative, path), 401)


@pytest.mark.parametrize("path", ["/probe/private", "/probe/api/typed?number=7"])
def test_private_csrf_is_enforced_even_on_ninja_generated_views(identity, path):
    client = Client(enforce_csrf_checks=True)
    client.force_login(identity)
    assert_closed_error(
        client.post(path, data="request-secret", content_type="application/json"), 403
    )
    client.cookies["csrftoken"] = "a" * 32
    assert_closed_error(client.post(path, HTTP_X_CSRFTOKEN="b" * 32), 403)
    assert client.post(path, HTTP_X_CSRFTOKEN="a" * 32).status_code == 200
    assert len(guard_urls.invocations) == 1
