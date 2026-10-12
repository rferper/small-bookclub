"""Member catalogue contains no operational or spoiler payloads."""

from datetime import date

import pytest
from django.test import Client
from django.utils import timezone
from jsonschema import Draft202012Validator, FormatChecker

from books.models import Book
from config.contract import read_contract, resolve
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]


@pytest.mark.parametrize("role", ["member", "admin"])
def test_member_catalogue_exposes_only_retained_book_metadata(role):
    viewer = User.objects.create_user(
        "100000000000000001", display_name="Fictional viewer", role=role, approved=True
    )
    admin = User.objects.create_user(
        "100000000000000002",
        display_name="Fictional admin",
        role="admin",
        approved=True,
    )
    rows = [
        Book.objects.create(
            title=f"Fictional {status}",
            authors=["Fictional author"],
            status=status,
            reading_start_date=date(1985, 1, 1),
            dates_approximate=True,
            description="Private operations sentinel",
            external_ids={"private": "External sentinel"},
        )
        for status in Book.Status.values
    ]
    rows[-1].soft_delete(admin)
    client = Client()
    client.force_login(viewer)
    response = client.get("/api/books")
    assert response.status_code == 200
    payload = response.json()
    document = read_contract()
    schema = resolve(
        document, document["paths"]["/api/books"]["get"]["responses"]["200"]
    )["content"]["application/json"]["schema"]
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(payload)
    assert payload == [
        {
            "id": str(row.pk),
            "title": row.title,
            "authors": row.authors,
            "coverUrl": None,
            "status": row.status,
            "readingStartDate": "1985-01-01",
            "readingEndDate": None,
            "datesApproximate": True,
        }
        for row in rows[:-1]
    ]
    assert "sentinel" not in str(payload).lower()


def test_catalogue_empty_and_membership_recheck():
    viewer = User.objects.create_user(
        "100000000000000001", display_name="Fictional viewer", approved=True
    )
    client = Client()
    assert client.get("/api/books").status_code == 401
    client.force_login(viewer)
    assert client.get("/api/books").json() == []
    User.objects.filter(pk=viewer.pk).update(approved=False, revoked_at=timezone.now())
    response = client.get("/api/books")
    assert response.status_code == 401 and response.json()["code"] == "unauthenticated"
