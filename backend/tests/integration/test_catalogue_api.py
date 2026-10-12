"""Mounted manual catalogue workflows, private media and atomic refusal."""

import io
import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from django.utils import timezone
from jsonschema import Draft202012Validator, FormatChecker
from PIL import Image

from books.models import Book
from config.contract import read_contract, resolve
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
PATH = "/api/admin/books"


@pytest.fixture
def identities(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "private"
    return [
        User.objects.create_user(
            f"1000000000000000{index:02d}",
            display_name=f"Fictional {index}",
            role="admin" if index == 1 else "member",
            approved=True,
        )
        for index in [1, 2]
    ]


def browser(identity=None):
    client = Client(enforce_csrf_checks=True)
    if identity:
        client.force_login(identity)
    client.get("/api/session")
    return client


def metadata(**changes):
    return {
        "title": "  Fictional book  ",
        "authors": ["  Fictional author  ", " "],
        "status": "propuesto",
        "description": None,
        "publicationDate": "circa 1900",
        "publisher": None,
        "isbn": None,
        "pageCount": None,
        "readingStartDate": None,
        "readingEndDate": None,
        "datesApproximate": True,
        "plannedStartDate": None,
        "plannedEndDate": None,
        "coverAction": "keep",
        **changes,
    }


def image(mime="image/png", image_format="PNG"):
    data = io.BytesIO()
    Image.new("RGB", (4, 4), "green").save(data, format=image_format)
    return SimpleUploadedFile("untrusted-name.png", data.getvalue(), content_type=mime)


def save(client, value=None, *, book_id=None, cover=None, csrf=True):
    fields = {
        "metadata": SimpleUploadedFile(
            "metadata",
            json.dumps(metadata() if value is None else value).encode(),
            content_type="application/json",
        )
    }
    if cover is not None:
        fields["cover"] = cover
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    return client.generic(
        "POST" if book_id is None else "PUT",
        PATH if book_id is None else f"{PATH}/{book_id}",
        data=encode_multipart(BOUNDARY, fields),
        content_type=MULTIPART_CONTENT,
        **headers,
    )


def result(response, method, status, *, detail=False):
    assert response.status_code == status, response.content
    document = read_contract()
    schema = resolve(
        document,
        document["paths"][PATH + ("/{bookId}" if detail else "")][method]["responses"][
            str(status)
        ],
    )["content"]["application/json"]["schema"]
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(
        response.json()
    )
    return response.json()


def test_create_entirely_manual_historical_book_then_edit_and_list(identities):
    client = browser(identities[0])
    created = result(save(client), "post", 201)
    assert created["title"] == "Fictional book" and created["authors"] == [
        "Fictional author"
    ]
    assert created["publicationDate"] == "circa 1900"
    assert created["readingStartDate"] is None and created["originVote"] is None
    row = Book.objects.get(pk=created["id"])
    row.external_ids = {"fictional": "preserve"}
    row.save(update_fields=["external_ids"])
    edited = result(
        save(
            client,
            metadata(
                title="Changed fictional",
                readingStartDate="1985-01-01",
                readingEndDate="1985-02-01",
            ),
            book_id=created["id"],
        ),
        "put",
        200,
        detail=True,
    )
    assert edited["id"] == created["id"] and edited["readingStartDate"] == "1985-01-01"
    row.refresh_from_db()
    assert row.external_ids == {"fictional": "preserve"}
    assert result(client.get(f"{PATH}/{row.pk}"), "get", 200, detail=True) == edited
    assert result(client.get(PATH), "get", 200) == [edited]


def test_permissions_and_csrf_precede_lookup_and_input(identities):
    for client, status in [(browser(), 401), (browser(identities[1]), 403)]:
        result(client.get(PATH), "get", status)
        result(client.get(f"{PATH}/not-a-key"), "get", status, detail=True)
        result(save(client, {}), "post", status)
        result(save(client, {}, book_id="not-a-key"), "put", status, detail=True)
    client = browser(identities[0])
    result(save(client, csrf=False), "post", 403)
    result(save(client, {}, book_id="not-a-key"), "put", 404, detail=True)
    assert not Book.objects.exists()


@pytest.mark.parametrize(
    "changes",
    [
        {"title": " "},
        {"title": 5},
        {"authors": [None]},
        {"authors": ["x" * 121]},
        {"status": "bad"},
        {"pageCount": True},
        {"description": "x" * 5001},
        {"readingStartDate": "0000-01-01"},
        {"readingEndDate": "2026-01-01T00:00:00Z"},
        {"plannedStartDate": "2026-02-01", "plannedEndDate": "2026-01-01"},
        {"coverAction": []},
        {"coverAction": {}},
        {"id": "another"},
        {"externalIds": {}},
        {"coverAction": "replace"},
        {"metadataResultId": "unsolicited"},
    ],
)
def test_invalid_save_leaves_existing_metadata_unchanged(identities, changes):
    client = browser(identities[0])
    baseline = result(save(client), "post", 201)
    result(
        save(client, metadata(**changes), book_id=baseline["id"]),
        "put",
        400,
        detail=True,
    )
    assert (
        result(client.get(f"{PATH}/{baseline['id']}"), "get", 200, detail=True)
        == baseline
    )
    assert Book.objects.count() == 1


def test_second_reading_conflict_after_image_processing_creates_no_file(
    identities, settings
):
    client = browser(identities[0])
    result(save(client, metadata(status="leyendo")), "post", 201)
    result(
        save(client, metadata(status="leyendo", coverAction="replace"), cover=image()),
        "post",
        409,
    )
    assert Book.objects.count() == 1 and not (settings.MEDIA_ROOT / "covers").exists()


@pytest.mark.parametrize(
    "mime,image_format",
    [("image/jpeg", "JPEG"), ("image/png", "PNG"), ("image/webp", "WEBP")],
)
def test_private_cover_lifecycle_and_visibility(
    identities, settings, django_capture_on_commit_callbacks, mime, image_format
):
    owner, viewer = browser(identities[0]), browser(identities[1])
    created = result(
        save(owner, metadata(coverAction="replace"), cover=image(mime, image_format)),
        "post",
        201,
    )
    url = created["coverUrl"]
    media = viewer.get(url)
    assert media.status_code == 200 and media["Content-Type"] == "image/webp"
    assert (
        media["Cache-Control"] == "private, no-store"
        and media["X-Content-Type-Options"] == "nosniff"
    )
    assert browser().get(url).status_code == 401
    kept = result(save(owner, book_id=created["id"]), "put", 200, detail=True)
    assert kept["coverUrl"] == url
    with django_capture_on_commit_callbacks(execute=True):
        replaced = result(
            save(
                owner,
                metadata(coverAction="replace"),
                book_id=created["id"],
                cover=image(),
            ),
            "put",
            200,
            detail=True,
        )
    assert replaced["coverUrl"] != url and viewer.get(url).status_code == 404
    assert len(list((settings.MEDIA_ROOT / "covers").iterdir())) == 1
    with django_capture_on_commit_callbacks(execute=True):
        result(
            save(owner, metadata(coverAction="remove"), book_id=created["id"]),
            "put",
            200,
            detail=True,
        )
    assert viewer.get(replaced["coverUrl"]).status_code == 404
    assert list((settings.MEDIA_ROOT / "covers").iterdir()) == []


def test_removed_book_cover_and_revoked_viewer_are_denied(identities):
    owner, viewer = browser(identities[0]), browser(identities[1])
    created = result(
        save(owner, metadata(coverAction="replace"), cover=image()), "post", 201
    )
    row = Book.objects.get(pk=created["id"])
    row.soft_delete(identities[0])
    result(owner.get(f"{PATH}/{row.pk}"), "get", 404, detail=True)
    result(save(owner, book_id=row.pk), "put", 404, detail=True)
    assert result(owner.get(PATH), "get", 200) == []
    assert (
        viewer.get(created["coverUrl"]).status_code
        == viewer.get("/api/media/covers/unknown").status_code
        == 404
    )
    User.objects.filter(pk=identities[1].pk).update(
        approved=False, revoked_at=timezone.now()
    )
    assert viewer.get(created["coverUrl"]).status_code == 401


def test_invalid_image_and_unknown_import_reference_are_atomic(identities, settings):
    client = browser(identities[0])
    for upload in [
        SimpleUploadedFile(
            "fake.png", b"<script>fake</script>", content_type="image/png"
        ),
        SimpleUploadedFile("large.png", b"x" * (2097152 + 1), content_type="image/png"),
        image("image/jpeg"),
    ]:
        result(save(client, metadata(coverAction="replace"), cover=upload), "post", 400)
    result(
        save(client, metadata(coverAction="metadata", metadataResultId="unknown")),
        "post",
        404,
    )
    assert not Book.objects.exists() and not (settings.MEDIA_ROOT / "covers").exists()


def test_storage_or_database_failure_rolls_back_whole_edit(
    identities, settings, monkeypatch
):
    client = browser(identities[0])
    baseline = result(
        save(client, metadata(coverAction="replace"), cover=image()), "post", 201
    )
    old_files = set((settings.MEDIA_ROOT / "covers").iterdir())

    def failed_save(*args, **kwargs):
        raise OSError("Fictional storage failure")

    monkeypatch.setattr(Book, "save", failed_save)
    result(
        save(
            client,
            metadata(title="Changed", coverAction="replace"),
            book_id=baseline["id"],
            cover=image(),
        ),
        "put",
        500,
        detail=True,
    )
    assert (
        result(client.get(f"{PATH}/{baseline['id']}"), "get", 200, detail=True)
        == baseline
    )
    assert set((settings.MEDIA_ROOT / "covers").iterdir()) == old_files


def test_admin_authority_is_rechecked_after_image_work(
    identities, settings, monkeypatch
):
    from books import catalogue

    client = browser(identities[0])
    original = catalogue.encode_image

    def encode_then_revoke(upload):
        encoded = original(upload)
        User.objects.filter(pk=identities[0].pk).update(
            approved=False, revoked_at=timezone.now()
        )
        return encoded

    monkeypatch.setattr(catalogue, "encode_image", encode_then_revoke)
    result(save(client, metadata(coverAction="replace"), cover=image()), "post", 401)
    assert not Book.objects.exists() and not (settings.MEDIA_ROOT / "covers").exists()
