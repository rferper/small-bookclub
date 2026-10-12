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


@pytest.mark.parametrize("role", ["member", "admin"])
def test_detail_metadata_contract_and_unknown_removed_denial(role):
    viewer = User.objects.create_user(
        "100000000000000001", display_name="Fictional viewer", role=role, approved=True
    )
    admin = User.objects.create_user(
        "100000000000000002",
        display_name="Fictional admin",
        role="admin",
        approved=True,
    )
    book = Book.objects.create(
        title="Fictional",
        authors=["Fictional author"],
        description="Fictional public description",
        publication_date="circa 1900",
        page_count=180,
        external_ids={"private": "Not projected"},
    )
    client = Client()
    assert (
        client.get(f"/api/books/{book.pk}").status_code
        == client.get("/api/books/unknown").status_code
        == 401
    )
    client.force_login(viewer)
    response = client.get(f"/api/books/{book.pk}")
    assert response.status_code == 200
    document = read_contract()
    schema = resolve(
        document, document["paths"]["/api/books/{bookId}"]["get"]["responses"]["200"]
    )["content"]["application/json"]["schema"]
    data = response.json()
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(data)
    assert data == {
        "id": str(book.pk),
        "title": "Fictional",
        "authors": ["Fictional author"],
        "coverUrl": None,
        "status": "propuesto",
        "readingStartDate": None,
        "readingEndDate": None,
        "datesApproximate": False,
        "plannedStartDate": None,
        "plannedEndDate": None,
        "description": book.description,
        "publicationDate": "circa 1900",
        "publisher": None,
        "isbn": None,
        "pageCount": 180,
        "originVote": None,
        "schedule": [],
        "meetings": [],
    }
    book.soft_delete(admin)
    removed = client.get(f"/api/books/{book.pk}")
    assert removed.status_code == 404
    for key in ["unknown", "999999", "0", "9" * 30]:
        missing = client.get(f"/api/books/{key}")
        assert missing.status_code == 404 and missing.json() == removed.json()
    User.objects.filter(pk=viewer.pk).update(approved=False, revoked_at=timezone.now())
    assert client.get(f"/api/books/{book.pk}").status_code == 401
