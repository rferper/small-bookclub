"""Directory responses expose active native profiles only."""

import pytest
from django.test import Client
from django.utils import timezone
from jsonschema import Draft202012Validator

from config.contract import read_contract, resolve
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]


@pytest.fixture
def identities():
    rows = []
    for number, name in enumerate(
        ["Óscar", "Ñora", "Nora", "Álba", "Revoked", "Pending"], 1
    ):
        rows.append(
            User.objects.create_user(
                f"1000000000000000{number:02d}",
                display_name=name,
                approved=number <= 4,
                role="admin" if number == 1 else "member",
                revoked_at=timezone.now() if number == 5 else None,
                bio="<script>Fictional biography</script>",
                favourite_quote="Fictional quote",
            )
        )
    return rows


def browser(identity=None):
    client = Client()
    if identity:
        client.force_login(identity)
    return client


def response(client, url, status=200):
    result = client.get(url)
    assert result.status_code == status, result.content
    path = "/api/members" if url == "/api/members" else "/api/members/{memberId}"
    document = read_contract()
    schema = resolve(
        document, document["paths"][path]["get"]["responses"][str(status)]
    )["content"]["application/json"]["schema"]
    Draft202012Validator(schema).validate(result.json())
    return result.json()


@pytest.mark.parametrize("viewer", [0, 1, 2, 3])
def test_directory_includes_self_and_active_members_in_spanish_order(
    identities, viewer
):
    client = browser(identities[viewer])
    result = response(client, "/api/members")
    assert result["currentWeekNumber"] is None
    entries = result["members"]
    assert [entry["member"]["displayName"] for entry in entries] == [
        "Álba",
        "Nora",
        "Ñora",
        "Óscar",
    ]
    assert sum(entry["isMe"] for entry in entries) == 1
    assert next(entry for entry in entries if entry["isMe"])["member"]["id"] == str(
        identities[viewer].pk
    )
    for entry in entries:
        assert entry["completedCurrentWeek"] is None
        assert set(entry) == {"member", "isMe", "completedCurrentWeek"}
        assert set(entry["member"]) == {"id", "displayName", "avatarUrl"}
    for identity in identities:
        assert identity.discord_user_id not in str(result)


@pytest.mark.parametrize("viewer", [0, 1])
def test_profile_returns_native_fields_and_correct_is_me(identities, viewer):
    client = browser(identities[viewer])
    target = identities[1]
    result = response(client, f"/api/members/{target.pk}")
    assert result == {
        "member": {
            "id": str(target.pk),
            "displayName": target.display_name,
            "avatarUrl": None,
        },
        "bio": target.bio,
        "favouriteQuote": target.favourite_quote,
        "favouriteBooks": [],
        "currentWeek": None,
        "isMe": viewer == 1,
    }


def test_hidden_and_unknown_profiles_are_indistinguishable(identities):
    client = browser(identities[1])
    results = [
        response(client, f"/api/members/{target}", 404)
        for target in [
            identities[4].pk,
            identities[5].pk,
            "999999",
            "not-a-key",
            "0",
            "9" * 30,
        ]
    ]
    assert all(result == results[0] for result in results)


@pytest.mark.parametrize("viewer", [None, 4, 5])
def test_nonmembers_are_denied_before_any_target_lookup(identities, viewer):
    client = browser(identities[viewer] if viewer is not None else None)
    denied = response(client, "/api/members", 401)
    for target in [identities[1].pk, identities[4].pk, "bad"]:
        assert response(client, f"/api/members/{target}", 401) == denied


def test_existing_viewer_and_target_are_rechecked_after_revocation(identities):
    client = browser(identities[1])
    target = identities[2]
    response(client, f"/api/members/{target.pk}")
    User.objects.filter(pk=target.pk).update(approved=False, revoked_at=timezone.now())
    response(client, f"/api/members/{target.pk}", 404)
    assert str(target.pk) not in [
        entry["member"]["id"] for entry in response(client, "/api/members")["members"]
    ]
    User.objects.filter(pk=identities[1].pk).update(
        approved=False, revoked_at=timezone.now()
    )
    response(client, "/api/members", 401)
    response(client, f"/api/members/{identities[0].pk}", 401)
