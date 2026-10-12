"""Offline provider integration, session-bound receipts and manual fallback."""

import io
import json
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from django.utils import timezone
from jsonschema import Draft202012Validator
from PIL import Image

from books import metadata
from books.models import Book
from config.contract import read_contract, resolve
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
PATH = "/api/admin/book-metadata"
PROVIDER = {
    "docs": [
        {
            "key": "/works/OL123W",
            "title": "Fictional provider book",
            "author_name": ["Fictional author"],
            "first_publish_year": 1900,
            "cover_i": 123,
        }
    ]
}


@pytest.fixture
def users(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "private"
    return [
        User.objects.create_user(
            f"1000000000000000{index:02d}",
            display_name="Fictional reader",
            role="admin" if index <= 2 else "member",
            approved=True,
        )
        for index in [1, 2, 3]
    ]


def browser(user=None):
    client = Client(enforce_csrf_checks=True)
    if user:
        client.force_login(user)
    client.get("/api/session")
    return client


def search(client, query="fictional", status=200):
    response = client.get(PATH, {"query": query})
    assert response.status_code == status, response.content
    document = read_contract()
    schema = resolve(
        document, document["paths"][PATH]["get"]["responses"][str(status)]
    )["content"]["application/json"]["schema"]
    Draft202012Validator(schema).validate(response.json())
    return response.json()


def create(client, result_id=None):
    value = {
        "title": "Manually corrected fictional",
        "authors": [],
        "status": "propuesto",
        "description": None,
        "publicationDate": None,
        "publisher": None,
        "isbn": None,
        "pageCount": None,
        "readingStartDate": None,
        "readingEndDate": None,
        "plannedStartDate": None,
        "plannedEndDate": None,
        "datesApproximate": False,
        "coverAction": "metadata" if result_id else "keep",
        **({"metadataResultId": result_id} if result_id else {}),
    }
    parts = {
        "metadata": SimpleUploadedFile(
            "metadata", json.dumps(value).encode(), content_type="application/json"
        )
    }
    return client.generic(
        "POST",
        "/api/admin/books",
        encode_multipart(BOUNDARY, parts),
        content_type=MULTIPART_CONTENT,
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )


@pytest.fixture
def provider(monkeypatch):
    calls = []
    cover = io.BytesIO()
    Image.new("RGB", (4, 4), "green").save(cover, format="JPEG")

    def fake(url, limit, accept):
        calls.append((url, limit, accept))
        if url.startswith("https://openlibrary.org/search.json?"):
            return json.dumps(PROVIDER).encode(), "application/json"
        assert url == "https://covers.openlibrary.org/b/id/123-M.jpg?default=false"
        return cover.getvalue(), "image/jpeg"

    monkeypatch.setattr(metadata, "fetch_provider", fake)
    return calls


def test_search_is_closed_cached_and_does_not_write_catalogue(users, provider):
    client = browser(users[0])
    first = search(client, " fictional & author ")
    assert len(first) == 1 and first[0]["title"] == "Fictional provider book"
    assert first[0]["publicationDate"] == "1900" and first[0]["isbn"] is None
    assert first[0]["coverUrl"].startswith("https://covers.openlibrary.org/b/id/123")
    assert first == search(client, "fictional & author")
    assert len(provider) == 1 and "q=fictional+%26+author" in provider[0][0]
    assert not Book.objects.exists()
    assert all(user.discord_user_id not in str(first) for user in users)


def test_only_same_admin_session_can_import_known_cover_and_edit_fields(
    users, provider
):
    client = browser(users[0])
    receipt = search(client)[0]["id"]
    assert create(browser(users[0]), receipt).status_code == 404
    assert create(browser(users[1]), receipt).status_code == 404
    response = create(client, receipt)
    assert response.status_code == 201, response.content
    created = response.json()
    assert created["title"] == "Manually corrected fictional"
    assert created["authors"] == [] and created["publicationDate"] is None
    assert created["coverUrl"].startswith("/api/media/covers/")
    assert browser(users[2]).get(created["coverUrl"]).status_code == 200
    assert Book.objects.get(pk=created["id"]).external_ids == {
        "openLibraryWork": "/works/OL123W"
    }


def test_expired_receipt_does_not_trigger_cover_fetch(users, provider, monkeypatch):
    client = browser(users[0])
    receipt = search(client)[0]["id"]
    instant = timezone.now()
    monkeypatch.setattr(timezone, "now", lambda: instant + timedelta(seconds=901))
    assert create(client, receipt).status_code == 404
    assert len(provider) == 1 and not Book.objects.exists()


def test_membership_and_query_validation_precede_provider(users, provider):
    search(browser(), status=401)
    search(browser(users[2]), status=403)
    client = browser(users[0])
    for query in [" ", "x" * 201, "bad\x00query"]:
        search(client, query, 400)
    assert client.get(PATH).status_code == 400
    assert client.get(PATH + "?query=a&query=b").status_code == 400
    assert provider == []


def test_provider_failure_keeps_manual_create_working(users, monkeypatch):
    def failed(*args):
        raise metadata.MetadataUnavailable("Private provider details")

    monkeypatch.setattr(metadata, "fetch_provider", failed)
    client = browser(users[0])
    denied = search(client, status=503)
    assert "Private provider" not in str(denied)
    assert create(client).status_code == 201


@pytest.mark.parametrize(
    "payload,mime",
    [
        (b"not-json", "application/json"),
        (b"{}", "application/json"),
        (b"[]", "application/json"),
        (b"<html>error</html>", "text/html"),
    ],
)
def test_invalid_provider_responses_fail_safely(users, monkeypatch, payload, mime):
    monkeypatch.setattr(metadata, "fetch_provider", lambda *args: (payload, mime))
    assert search(browser(users[0]), status=503)["code"] == "service_unavailable"


def test_invalid_provider_documents_are_skipped_and_result_count_bounded(
    users, monkeypatch
):
    payload = {
        "docs": [
            None,
            {"key": "https://evil.test", "title": "Bad"},
            {
                "key": "OL456W",
                "title": "x" * 250,
                "author_name": ["x" * 150] * 30,
                "cover_i": "https://evil.test",
            },
        ]
        + PROVIDER["docs"] * 20
    }
    monkeypatch.setattr(
        metadata,
        "fetch_provider",
        lambda *args: (json.dumps(payload).encode(), "application/json"),
    )
    rows = search(browser(users[0]))
    assert len(rows) <= 8 and rows[0]["coverUrl"] is None
    assert len(rows[0]["title"]) == 200 and len(rows[0]["authors"]) == 20


def test_cover_provider_failure_does_not_create_partial_book(
    users, provider, monkeypatch, settings
):
    client = browser(users[0])
    receipt = search(client)[0]["id"]
    monkeypatch.setattr(
        metadata, "fetch_provider", lambda *args: (b"malicious", "image/jpeg")
    )
    response = create(client, receipt)
    assert response.status_code == 503
    assert not Book.objects.exists() and not (settings.MEDIA_ROOT / "covers").exists()


def test_search_rechecks_authority_after_provider_work(users, monkeypatch):
    def revoke(*args):
        User.objects.filter(pk=users[0].pk).update(
            approved=False, revoked_at=timezone.now()
        )
        return json.dumps(PROVIDER).encode(), "application/json"

    monkeypatch.setattr(metadata, "fetch_provider", revoke)
    search(browser(users[0]), status=401)
