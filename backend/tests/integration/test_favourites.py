"""Native ranked preferences, ownership, retained-parent privacy and export."""

import io
import json
import zipfile
from datetime import datetime, timezone

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import Client
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator

from books.models import Book
from config.contract import read_contract, resolve
from users.authentication import EXPORT_KEY
from users.models import FavouriteBook, User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
DOC = read_contract()
NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)


@pytest.fixture
def world(monkeypatch, settings, tmp_path):
    monkeypatch.setattr(django_timezone, "now", lambda: NOW)
    settings.MEDIA_ROOT = tmp_path
    users = [
        User.objects.create_user(
            f"8600000000000000{i:02d}",
            approved=True,
            role="admin" if i == 0 else "member",
            display_name=f"Fictional reader {i}",
        )
        for i in range(3)
    ]
    books = [
        Book.objects.create(
            title=title, description="PRIVATE_DESCRIPTION", status="terminado"
        )
        for title in ["Zeta", "Árbol", "Ñube", "Cuarto", "Quinto", "Sexto"]
    ]
    return users, books


def browser(actor=None):
    client = Client(enforce_csrf_checks=True)
    if actor:
        client.force_login(actor)
    client.get("/api/session")
    return client


def save(client, ids, status=200, extra=None, avatar=None, csrf=True):
    metadata = {
        "displayName": "Fictional changed name",
        "bio": "Fictional bio",
        "favouriteQuote": None,
        "favouriteBookIds": ids,
        "avatarAction": "replace" if avatar else "keep",
        **(extra or {}),
    }
    parts = {
        "metadata": SimpleUploadedFile(
            "metadata.json",
            json.dumps(metadata).encode(),
            content_type="application/json",
        )
    }
    if avatar:
        parts["avatar"] = avatar
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    response = client.put(
        "/api/me/profile",
        data=encode_multipart(BOUNDARY, parts),
        content_type=MULTIPART_CONTENT,
        **headers,
    )
    assert response.status_code == status, response.content
    schema = resolve(
        DOC, DOC["paths"]["/api/me/profile"]["put"]["responses"][str(status)]
    )["content"]["application/json"]["schema"]
    Draft202012Validator(schema).validate(response.json())
    return response.json()


def read(client, path="/api/me/profile"):
    response = client.get(path)
    assert response.status_code == 200, response.content
    template = (
        "/api/me/profile" if path == "/api/me/profile" else "/api/members/{memberId}"
    )
    schema = resolve(DOC, DOC["paths"][template]["get"]["responses"]["200"])["content"][
        "application/json"
    ]["schema"]
    Draft202012Validator(schema).validate(response.json())
    assert "PRIVATE_" not in response.content.decode()
    return response.json()


@pytest.mark.parametrize("viewer", [0, 1])
def test_member_and_admin_persist_ranked_favourites_in_existing_profile_and_directory(
    world, viewer
):
    users, books = world
    client = browser(users[viewer])
    initial = read(client)
    assert initial["favouriteBooks"] == []
    assert [row["title"] for row in initial["favouriteOptions"]] == [
        "Árbol",
        "Cuarto",
        "Ñube",
        "Quinto",
        "Sexto",
        "Zeta",
    ]
    ids = [str(books[i].pk) for i in [2, 0, 1, 4, 5]]
    result = save(client, ids)
    assert [row["id"] for row in result["favouriteBooks"]] == ids
    assert list(
        FavouriteBook.objects.filter(member=users[viewer]).values_list(
            "rank", flat=True
        )
    ) == [1, 2, 3, 4, 5]
    public = read(browser(users[(viewer + 1) % 3]), f"/api/members/{users[viewer].pk}")
    assert public["favouriteBooks"] == result["favouriteBooks"]
    save(client, [ids[-1]])
    assert FavouriteBook.objects.filter(member=users[viewer]).count() == 1
    save(client, [])
    assert not FavouriteBook.objects.filter(member=users[viewer]).exists()


@pytest.mark.parametrize(
    "bad",
    [
        None,
        "1",
        [True],
        ["bad-id"],
        ["0"],
        ["999999"],
        ["1", "01"],
        ["1", "1"],
        ["1", "2", "3", "4", "5", "6"],
    ],
)
def test_invalid_or_duplicate_ids_roll_back_profile_and_existing_favourites(world, bad):
    users, books = world
    client = browser(users[1])
    save(client, [str(books[0].pk)])
    before = read(client)
    save(client, bad, 400)
    assert read(client) == before


def test_ownership_csrf_and_revocation_cannot_write_another_member_selection(world):
    users, books = world
    client = browser(users[1])
    save(client, [str(books[0].pk)], 403, extra={"memberId": str(users[2].pk)})
    save(client, [str(books[0].pk)], 403, csrf=False)
    assert not FavouriteBook.objects.exists()
    User.objects.filter(pk=users[1].pk).update(approved=False, revoked_at=NOW)
    save(client, [str(books[0].pk)], 401)
    assert not FavouriteBook.objects.exists()
    assert client.get("/api/me/profile").status_code == 401


def test_removed_book_is_hidden_retained_restorable_and_blocks_purge_with_safe_warning(
    world,
):
    users, books = world
    member = browser(users[1])
    admin = browser(users[0])
    book = books[0]
    save(member, [str(book.pk)])
    book.soft_delete(users[0])
    assert read(member)["favouriteBooks"] == []
    assert str(book.pk) not in [row["id"] for row in read(member)["favouriteOptions"]]
    assert (
        read(browser(users[2]), f"/api/members/{users[1].pk}")["favouriteBooks"] == []
    )
    assert FavouriteBook.objects.filter(book=book).count() == 1
    headers = {"HTTP_X_CSRFTOKEN": admin.cookies["csrftoken"].value}
    response = admin.delete(f"/api/admin/bin/book/{book.pk}", **headers)
    assert response.status_code == 409
    row = next(
        row
        for row in admin.get("/api/admin/bin").json()
        if row["type"] == "book" and row["id"] == str(book.pk)
    )
    assert any("favoritos" in label for label in row["dependencies"])
    book.restore(users[0])
    assert read(member)["favouriteBooks"][0]["id"] == str(book.pk)


def test_removed_parent_and_failure_during_preference_write_preserve_profile_and_links(
    world, monkeypatch
):
    users, books = world
    client = browser(users[1])
    save(client, [str(books[0].pk)])
    books[1].soft_delete(users[0])
    before = read(client)
    save(client, [str(books[1].pk)], 400)
    assert read(client) == before

    def fail(*args, **kwargs):
        raise RuntimeError("PRIVATE_PREFERENCE_FAILURE")

    monkeypatch.setattr(FavouriteBook.objects, "bulk_create", fail)
    body = save(client, [str(books[2].pk)], 500)
    assert "PRIVATE_" not in str(body)
    assert read(client) == before


def test_avatar_and_preference_failure_roll_back_together(world, monkeypatch, settings):
    from PIL import Image

    users, books = world
    client = browser(users[1])
    before = read(client)
    image = io.BytesIO()
    Image.new("RGB", (3, 3), "green").save(image, format="PNG")
    avatar = SimpleUploadedFile(
        "avatar.png", image.getvalue(), content_type="image/png"
    )

    def fail(*args, **kwargs):
        raise RuntimeError("PRIVATE_PREFERENCE_FAILURE")

    monkeypatch.setattr(FavouriteBook.objects, "bulk_create", fail)
    save(client, [str(books[0].pk)], 500, avatar=avatar)
    assert read(client) == before
    assert not list(settings.MEDIA_ROOT.rglob("*.webp"))


def test_stale_membership_or_parent_removal_during_parse_changes_no_profile(
    world, monkeypatch
):
    from users import profile

    users, books = world
    client = browser(users[1])
    save(client, [str(books[0].pk)])
    original = profile.parse_input
    before = read(client)

    def remove_parent(request):
        result = original(request)
        books[1].soft_delete(users[0])
        return result

    monkeypatch.setattr(profile, "parse_input", remove_parent)
    save(client, [str(books[1].pk)], 400)
    assert read(client)["favouriteBooks"] == before["favouriteBooks"]
    assert (
        User.objects.get(pk=users[1].pk).display_name == before["member"]["displayName"]
    )

    def revoke_owner(request):
        result = original(request)
        User.objects.filter(pk=users[1].pk).update(approved=False, revoked_at=NOW)
        return result

    monkeypatch.setattr(profile, "parse_input", revoke_owner)
    save(client, [str(books[2].pk)], 401)
    assert list(
        FavouriteBook.objects.filter(member=users[1]).values_list("book_id", flat=True)
    ) == [books[0].pk]


def test_privileged_export_includes_actual_ranked_retained_favourite_ids(world):
    users, books = world
    ids = [str(books[2].pk), str(books[0].pk)]
    save(browser(users[1]), ids)
    books[0].soft_delete(users[0])
    admin = browser(users[0])
    session = admin.session
    session[EXPORT_KEY] = {
        "id": str(users[0].pk),
        "discord": users[0].discord_user_id,
        "at": NOW.timestamp(),
    }
    session.save()
    response = admin.post(
        "/api/admin/export", HTTP_X_CSRFTOKEN=admin.cookies["csrftoken"].value
    )
    assert response.status_code == 200, response.content
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        records = json.loads(archive.read("club.json"))
    Draft202012Validator(
        resolve(DOC, DOC["components"]["schemas"]["ClubBusinessExport"])
    ).validate(records)
    profile = next(
        row for row in records["profiles"] if row["memberId"] == str(users[1].pk)
    )
    assert profile["favouriteBookIds"] == ids


def test_rank_unique_pair_and_five_item_limit_are_sql_enforced(world):
    users, books = world
    FavouriteBook.objects.create(member=users[1], book=books[0], rank=1)
    for data in [
        {"book": books[0], "rank": 2},
        {"book": books[1], "rank": 1},
        {"book": books[1], "rank": 0},
        {"book": books[1], "rank": 6},
    ]:
        with pytest.raises(IntegrityError), transaction.atomic():
            FavouriteBook.objects.create(member=users[1], **data)


@pytest.mark.parametrize("status", ["propuesto", "elegido", "leyendo"])
def test_only_club_completed_or_archived_books_are_new_favourite_options(world, status):
    users, books = world
    client = browser(users[1])
    save(client, [str(books[0].pk)])
    Book.objects.filter(pk=books[0].pk).update(status=status)
    result = read(client)
    assert str(books[0].pk) not in [row["id"] for row in result["favouriteOptions"]]
    assert result["favouriteBooks"][0]["id"] == str(books[0].pk)
    save(client, [str(books[0].pk)], 400)
    assert FavouriteBook.objects.filter(book=books[0]).exists()
    Book.objects.filter(pk=books[0].pk).update(status="archivado")
    assert read(client)["favouriteBooks"][0]["id"] == str(books[0].pk)
    save(client, [str(books[0].pk)])
