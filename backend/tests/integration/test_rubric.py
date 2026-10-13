"""Whole rubric storage, private reads and admin-only atomic writes."""

import json

import pytest
from django.db import IntegrityError, transaction
from django.test import Client
from django.utils import timezone
from jsonschema import Draft202012Validator

from config.contract import read_contract, resolve
from reviews.models import CRITERIA, RatingRubric
from users.models import CuratorAssignment, User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
READ = "/api/rating-rubric"
SAVE = "/api/admin/rating-rubric"
DOC = read_contract()


def empty():
    return {
        criterion: {str(star): None for star in range(1, 6)} for criterion in CRITERIA
    }


@pytest.fixture
def identities():
    users = [
        User.objects.create_user(
            f"3000000000000000{n:02d}",
            approved=True,
            role="admin" if n == 1 else "member",
            display_name=f"Fictional reader {n}",
        )
        for n in range(1, 4)
    ]
    CuratorAssignment.objects.create(member=users[2])
    return users


def browser(actor=None):
    client = Client(enforce_csrf_checks=True)
    if actor:
        client.force_login(actor)
    client.get("/api/session")
    return client


def save(client, value, csrf=True):
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    return client.put(
        SAVE,
        data=value if isinstance(value, str) else json.dumps(value),
        content_type="application/json",
        **headers,
    )


def checked(response, status=200, path=READ):
    assert response.status_code == status, response.content
    operation = DOC["paths"][path]["get" if path == READ else "put"]
    content = resolve(DOC, operation["responses"][str(status)])
    value = response.json()
    Draft202012Validator(content["content"]["application/json"]["schema"]).validate(
        value
    )
    return value


def test_owner_has_25_null_anchors_until_they_supply_prose(identities):
    assert RatingRubric.objects.count() == 25
    assert not RatingRubric.objects.exclude(description=None).exists()
    for actor in identities:
        assert checked(browser(actor).get(READ)) == empty()
    value = empty()
    value["disfrute"]["1"] = "  <b>Anclaje ficticio</b>\nliteral  "
    value["estilo"]["5"] = "x" * 500
    value["huella"]["3"] = "  "
    admin = browser(identities[0])
    result = checked(save(admin, value), path=SAVE)
    assert result["disfrute"]["1"] == "<b>Anclaje ficticio</b>\nliteral"
    assert result["huella"]["3"] is None
    assert checked(browser(identities[1]).get(READ)) == result
    assert checked(save(admin, empty()), path=SAVE) == empty()


@pytest.mark.parametrize(
    "invalid",
    [
        "criterion",
        "extra",
        "anchor",
        "half",
        "long",
        "number",
        "nul",
        "surrogate",
        "malformed",
    ],
)
def test_bad_last_anchor_never_partially_saves(identities, invalid):
    value = empty()
    value["disfrute"]["1"] = "A change that must not persist"
    if invalid == "criterion":
        del value["estilo"]
    elif invalid == "extra":
        value["extra"] = value["estilo"]
    elif invalid == "anchor":
        del value["huella"]["5"]
    elif invalid == "half":
        value["huella"]["2.5"] = None
    elif invalid == "malformed":
        value = "nope"
    else:
        value["huella"]["5"] = {
            "long": "x" * 501,
            "number": 3,
            "nul": "\x00",
            "surrogate": "\ud800",
        }[invalid]
    checked(save(browser(identities[0]), value), 400, SAVE)
    assert checked(browser(identities[0]).get(READ)) == empty()


def test_membership_role_and_csrf_precede_payload_validation(identities):
    admin, member, curator = identities
    checked(browser().get(READ), 401)
    checked(save(browser(), "malformed"), 401, SAVE)
    for actor in (member, curator):
        checked(save(browser(actor), "malformed"), 403, SAVE)
    client = browser(admin)
    checked(save(client, empty(), csrf=False), 403, SAVE)
    User.objects.filter(pk=admin.pk).update(role="member")
    checked(save(client, empty()), 403, SAVE)
    User.objects.filter(pk=admin.pk).update(approved=False, revoked_at=timezone.now())
    checked(save(client, empty()), 401, SAVE)
    checked(client.get(READ), 401)
    assert RatingRubric.objects.filter(description__isnull=False).count() == 0


@pytest.mark.parametrize(
    "values",
    [{"criterion": "other"}, {"star": 0}, {"star": 6}, {"description": "x" * 501}],
)
def test_sql_rejects_invalid_anchor_even_when_validation_is_bypassed(values):
    with pytest.raises(IntegrityError), transaction.atomic():
        RatingRubric.objects.filter(criterion="disfrute", star=1).update(**values)


def test_sql_rejects_duplicate_anchor():
    with pytest.raises(IntegrityError), transaction.atomic():
        RatingRubric.objects.create(criterion="disfrute", star=1)
