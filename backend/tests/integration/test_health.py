import pytest
from django.db import connections
from jsonschema import Draft202012Validator

from config.contract import read_contract, resolve

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("cookie", [None, "stale-session-cookie", "a" * 32])
def test_anonymous_health_is_exact_public_json_without_database_access(
    client, monkeypatch, cookie
):
    def forbidden_connection(*args, **kwargs):
        raise AssertionError("Liveness must not connect to a database")

    monkeypatch.setattr(
        connections["default"], "ensure_connection", forbidden_connection
    )
    if cookie is not None:
        client.cookies["sessionid"] = cookie
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.headers["Content-Type"].split(";")[0] == "application/json"
    assert response.json() == {"status": "ok"}
    assert "Location" not in response.headers
    assert not response.cookies
    contract = read_contract()
    schema = contract["paths"]["/api/health"]["get"]["responses"]["200"]["content"][
        "application/json"
    ]["schema"]
    Draft202012Validator(resolve(contract, schema)).validate(response.json())


def test_health_remains_public_with_csrf_checks_and_no_session():
    from django.test import Client

    response = Client(enforce_csrf_checks=True).get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
