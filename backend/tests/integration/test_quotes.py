"""Native quote management, retention and Home selection on fictional prose."""

from datetime import timedelta
from importlib import import_module

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import Client
from jsonschema import Draft202012Validator

from config.contract import read_contract, resolve
from core.models import LiteraryQuote
from users.models import CuratorAssignment, User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
DOC = read_contract()
BASE = "/api/admin/quotes"
VALID = {
    "text": "Cita ficticia.",
    "author": "Autora ficticia",
    "source": "Libro ficticio",
    "active": True,
}


@pytest.fixture
def world():
    LiteraryQuote.objects.update(active=False)
    users = [
        User.objects.create_user(
            f"6100000000000000{i:02d}",
            approved=True,
            role="admin" if i == 0 else "member",
            display_name=f"Fictional quote reader {i}",
        )
        for i in range(3)
    ]
    CuratorAssignment.objects.create(member=users[2])
    return users


def browser(actor=None):
    client = Client(enforce_csrf_checks=True)
    if actor:
        client.force_login(actor)
    client.get("/api/session")
    return client


def call(client, method, path=BASE, body=None, status=200, csrf=True):
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    kwargs = (
        {"data": body, "content_type": "application/json"} if body is not None else {}
    )
    response = getattr(client, method)(path, **kwargs, **headers)
    assert response.status_code == status, response.content
    template = BASE + "/{id}" if path.startswith(BASE + "/") else path
    if path.startswith("/api/admin/deletion-preview/"):
        template = "/api/admin/deletion-preview/{type}/{id}"
    schema = resolve(DOC, DOC["paths"][template][method]["responses"][str(status)])[
        "content"
    ]["application/json"]["schema"]
    Draft202012Validator(schema).validate(response.json())
    return response.json()


def test_admin_roundtrip_literal_text_stable_order_and_normalized_duplicates(world):
    client = browser(world[0])
    before = call(client, "get")
    quote = call(
        client,
        "post",
        body={**VALID, "text": "  <b>Cita ficticia</b>  ", "source": " "},
        status=201,
    )
    assert quote["text"] == "<b>Cita ficticia</b>" and quote["source"] is None
    second = call(
        client, "post", body={**VALID, "text": "Otra cita ficticia"}, status=201
    )
    result = call(
        client,
        "put",
        BASE + "/" + quote["id"],
        {**VALID, "active": False, "author": None},
    )
    assert result["id"] == quote["id"] and result["active"] is False
    call(client, "post", body={**VALID, "text": " CITA\nFICTICIA. "}, status=409)
    assert [row["id"] for row in call(client, "get")] == [
        *[row["id"] for row in before],
        quote["id"],
        second["id"],
    ]
    # Editing the same normalized text preserves its own identity.
    call(client, "put", BASE + "/" + quote["id"], {**VALID, "text": "CITA FICTICIA."})


@pytest.mark.parametrize(
    "role", ["anonymous", "member", "curator", "pending", "revoked"]
)
def test_nonadmins_cannot_manage_or_preview_even_unknown_quotes(world, role):
    actor = None if role == "anonymous" else world[2] if role == "curator" else world[1]
    client = browser(actor)
    if role in {"pending", "revoked"}:
        from django.utils import timezone

        User.objects.filter(pk=actor.pk).update(
            approved=False, revoked_at=timezone.now() if role == "revoked" else None
        )
    status = 401 if role in {"anonymous", "pending", "revoked"} else 403
    call(client, "get", status=status)
    call(client, "post", body={}, status=status)
    call(client, "put", BASE + "/999999", {}, status=status)
    call(client, "delete", BASE + "/999999", status=status)
    call(client, "get", "/api/admin/deletion-preview/quote/999999", status=status)


@pytest.mark.parametrize(
    "change",
    [
        {"text": " "},
        {"text": None},
        {"text": "x" * 1001},
        {"author": "x" * 201},
        {"source": "x" * 201},
        {"active": 1},
        {"text": "\x00"},
        {"text": "\ud800"},
        {"extra": True},
    ],
)
def test_invalid_input_refuses_atomic_writes(world, change):
    client = browser(world[0])
    before = call(client, "get")
    call(client, "post", body={**VALID, **change}, status=400)
    assert call(client, "get") == before


def test_csrf_lookup_precedence_and_fresh_admin_role(world):
    client = browser(world[0])
    call(client, "post", body=VALID, status=403, csrf=False)
    call(client, "put", BASE + "/unknown", {}, status=404)
    quote = call(client, "post", body=VALID, status=201)
    call(client, "put", BASE + "/" + quote["id"], VALID, status=403, csrf=False)
    call(client, "delete", BASE + "/" + quote["id"], status=403, csrf=False)
    User.objects.filter(pk=world[0].pk).update(role="member")
    call(client, "post", body={}, status=403)


def test_soft_removal_has_safe_bin_labels_and_reserves_duplicate_key(world):
    client = browser(world[0])
    quote = call(client, "post", body={**VALID, "text": "PRIVATE_QUOTE"}, status=201)
    path = BASE + "/" + quote["id"]
    preview = call(client, "get", "/api/admin/deletion-preview/quote/" + quote["id"])
    assert preview["label"] == "Cita literaria" and "PRIVATE_QUOTE" not in str(preview)
    result = call(client, "delete", path)
    assert "PRIVATE_QUOTE" not in str(result)
    assert result[0]["type"] == "quote" and result[0]["label"] == "Cita literaria"
    row = LiteraryQuote.all_objects.get(pk=quote["id"])
    assert row.active is True and row.purge_due_at - row.deleted_at == timedelta(
        days=30
    )
    assert row.deleted_by_id == world[0].pk
    call(client, "post", body={**VALID, "text": "private_quote"}, status=409)
    call(client, "delete", path, status=404)
    call(client, "put", path, VALID, status=404)
    assert all(item["id"] != quote["id"] for item in call(client, "get"))


def test_home_selects_active_retained_quotes_per_visit_and_empty_is_null(
    world, monkeypatch
):
    from core import quotes

    client = browser(world[1])
    assert call(client, "get", "/api/home")["quote"] is None
    first = LiteraryQuote.objects.create(**VALID)
    second = LiteraryQuote.objects.create(**{**VALID, "text": "Segunda cita ficticia"})
    LiteraryQuote.objects.create(**{**VALID, "text": "INACTIVE_QUOTE", "active": False})
    removed = LiteraryQuote.objects.create(**{**VALID, "text": "REMOVED_QUOTE"})
    removed.soft_delete(world[0])
    visits = []

    def choose(rows):
        visits.append([row.pk for row in rows])
        return rows[(len(visits) - 1) % len(rows)]

    monkeypatch.setattr(quotes, "choice", choose)
    assert call(client, "get", "/api/home")["quote"]["text"] == first.text
    assert call(client, "get", "/api/home")["quote"]["text"] == second.text
    assert visits == [[first.pk, second.pk], [first.pk, second.pk]]
    LiteraryQuote.objects.update(active=False)
    assert call(client, "get", "/api/home")["quote"] is None


@pytest.mark.parametrize(
    "change",
    [{"text": ""}, {"text": "x" * 1001}, {"author": "x" * 201}, {"source": "x" * 201}],
)
def test_sql_rejects_quote_length_violations(world, change):
    row = LiteraryQuote.objects.create(**VALID)
    with pytest.raises(IntegrityError), transaction.atomic():
        LiteraryQuote.objects.filter(pk=row.pk).update(**change)


def test_model_normalization_and_sql_duplicate_constraint(world):
    row = LiteraryQuote(**{**VALID, "text": "  ÁRBOL\n FICTICIO  "})
    row.full_clean()
    row.save()
    assert row.normalized_text == "árbol ficticio"
    with pytest.raises(IntegrityError), transaction.atomic():
        LiteraryQuote.objects.create(**{**VALID, "text": "árbol ficticio"})
    with pytest.raises(ValidationError):
        LiteraryQuote(**{**VALID, "active": 1}).full_clean()


def test_seed_migration_is_idempotent_and_application_does_not_reenable(world):
    module = import_module("core.migrations.0002_seed_literary_quotes")
    state = MigrationExecutor(connection).loader.project_state()

    class Editor:
        pass

    editor = Editor()
    editor.connection = connection
    before = LiteraryQuote.all_objects.count()
    module.seed(state.apps, editor)
    module.seed(state.apps, editor)
    assert LiteraryQuote.all_objects.count() == before
    seeded = list(LiteraryQuote.objects.filter(author="Miguel de Cervantes"))
    assert len(seeded) == 2 and all("1615" in row.source for row in seeded)
    # world disabled migration rows; runtime keeps that owner's decision.
    assert all(not row.active for row in seeded)
    assert call(browser(world[1]), "get", "/api/home")["quote"] is None
