"""The signed-in identity owns every profile write and private avatar read."""

import io
import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from django.utils import timezone
from jsonschema import Draft202012Validator
from PIL import Image

from config.contract import read_contract, resolve
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
PATH = "/api/me/profile"


@pytest.fixture
def members(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "private"
    return [
        User.objects.create_user(
            f"1000000000000000{number:02d}",
            display_name=name,
            role="admin" if number == 1 else "member",
            approved=True,
        )
        for number, name in enumerate(
            ["Alba ficticia", "Bruno ficticio", "Clara ficticia"], 1
        )
    ]


def browser(identity=None):
    client = Client(enforce_csrf_checks=True)
    if identity:
        client.force_login(identity)
    client.get("/api/session")
    return client


def metadata(value):
    return SimpleUploadedFile(
        "metadata", json.dumps(value).encode(), content_type="application/json"
    )


def payload(**changes):
    return {
        "displayName": "  Alba de prueba  ",
        "bio": "  Bio ficticia  ",
        "favouriteQuote": "  Una cita ficticia  ",
        "favouriteBookIds": [],
        "avatarAction": "keep",
        **changes,
    }


def image(content_type="image/png", image_format="PNG"):
    data = io.BytesIO()
    Image.new("RGB", (3, 3), "green").save(data, format=image_format)
    return SimpleUploadedFile("avatar.png", data.getvalue(), content_type=content_type)


def put(client, value=None, avatar=None, extra=None, csrf=True):
    fields = {
        "metadata": metadata(payload() if value is None else value),
        **(extra or {}),
    }
    if avatar is not None:
        fields["avatar"] = avatar
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    return client.put(
        PATH,
        data=encode_multipart(BOUNDARY, fields),
        content_type=MULTIPART_CONTENT,
        **headers,
    )


def contract_response(response, method, status):
    assert response.status_code == status, response.content
    contract = read_contract()
    schema = resolve(
        contract, contract["paths"][PATH][method]["responses"][str(status)]
    )["content"]["application/json"]["schema"]
    Draft202012Validator(schema).validate(response.json())
    return response.json()


@pytest.mark.parametrize("who", [0, 1, 2])
def test_each_active_role_reads_and_saves_only_own_profile(members, who):
    client = browser(members[who])
    before = contract_response(client.get(PATH), "get", 200)
    assert before["member"]["id"] == str(members[who].pk)
    saved = contract_response(put(client), "put", 200)
    assert saved == {
        **before,
        "member": {**before["member"], "displayName": "Alba de prueba"},
        "bio": "Bio ficticia",
        "favouriteQuote": "Una cita ficticia",
    }
    assert contract_response(client.get(PATH), "get", 200) == saved
    for other in members:
        other.refresh_from_db()
        if other.pk != members[who].pk:
            assert other.display_name != "Alba de prueba"


def test_membership_csrf_and_smuggled_ownership_precede_validation(members):
    anonymous = browser()
    contract_response(anonymous.get(PATH), "get", 401)
    assert put(anonymous, {"id": members[1].pk}).status_code == 401
    client = browser(members[1])
    contract_response(put(client, csrf=False), "put", 403)
    for key in ["id", "memberId", "userId", "ownerId"]:
        denied = put(
            client, {"id": str(members[2].pk), **payload(), key: str(members[2].pk)}
        )
        contract_response(denied, "put", 403)
        denied = put(client, extra={key: str(members[2].pk)})
        contract_response(denied, "put", 403)
    members[1].refresh_from_db()
    assert members[1].display_name == "Bruno ficticio"
    User.objects.filter(pk=members[1].pk).update(
        approved=False, revoked_at=timezone.now()
    )
    contract_response(client.get(PATH), "get", 401)


def test_invalid_metadata_and_avatar_leave_all_fields_unchanged(members):
    client = browser(members[1])
    baseline = contract_response(client.get(PATH), "get", 200)
    bad_values = [
        payload(displayName=" "),
        payload(displayName="bad\nname"),
        payload(bio="x" * 501),
        payload(favouriteQuote="x" * 301),
        payload(favouriteBookIds=["invented-book"]),
        payload(role="admin"),
        payload(avatarAction="replace"),
        payload(avatarAction=[]),
        payload(avatarAction={}),
    ]
    for value in bad_values:
        contract_response(put(client, value), "put", 400)
    contract_response(
        put(
            client,
            payload(avatarAction="replace"),
            SimpleUploadedFile(
                "fake.png", b"<script>x</script>", content_type="image/png"
            ),
        ),
        "put",
        400,
    )
    contract_response(
        put(client, payload(avatarAction="replace"), image("image/jpeg")), "put", 400
    )
    contract_response(
        put(
            client,
            payload(avatarAction="replace"),
            SimpleUploadedFile(
                "huge.png", b"x" * (2 * 1024 * 1024 + 1), content_type="image/png"
            ),
        ),
        "put",
        400,
    )
    assert contract_response(client.get(PATH), "get", 200) == baseline


def test_valid_avatar_with_invalid_metadata_creates_no_file(members, settings):
    client = browser(members[1])
    contract_response(
        put(client, payload(displayName="", avatarAction="replace"), image()),
        "put",
        400,
    )
    assert not (settings.MEDIA_ROOT / "avatars").exists()
    assert members[1].avatar_path == ""


def test_private_avatar_reencoded_and_hidden_after_replace_remove_or_revocation(
    members, settings
):
    owner = browser(members[1])
    viewer = browser(members[2])
    saved = contract_response(
        put(owner, payload(avatarAction="replace"), image()), "put", 200
    )
    url = saved["member"]["avatarUrl"]
    assert url.startswith("/api/media/avatars/")
    response = viewer.get(url)
    assert response.status_code == 200
    assert response["Content-Type"] == "image/webp"
    assert response["Cache-Control"] == "private, no-store"
    with Image.open(io.BytesIO(response.content)) as decoded:
        assert decoded.format == "WEBP"
    assert browser().get(url).status_code == 401
    assert not (settings.MEDIA_ROOT / "avatars" / "avatar.png").exists()
    new_url = contract_response(
        put(owner, payload(avatarAction="replace"), image()), "put", 200
    )["member"]["avatarUrl"]
    assert new_url != url
    assert viewer.get(url).status_code == 404
    assert viewer.get(new_url).status_code == 200
    contract_response(put(owner, payload(avatarAction="remove")), "put", 200)
    assert viewer.get(new_url).status_code == 404
    revoked_url = contract_response(
        put(owner, payload(avatarAction="replace"), image()), "put", 200
    )["member"]["avatarUrl"]
    User.objects.filter(pk=members[1].pk).update(
        approved=False, revoked_at=timezone.now()
    )
    assert viewer.get(revoked_url).status_code == 404
    assert owner.get(revoked_url).status_code == 401


@pytest.mark.parametrize(
    ("mime", "image_format"),
    [("image/jpeg", "JPEG"), ("image/png", "PNG"), ("image/webp", "WEBP")],
)
def test_supported_images_preserve_avatar_on_keep(members, mime, image_format):
    client = browser(members[1])
    saved = contract_response(
        put(client, payload(avatarAction="replace"), image(mime, image_format)),
        "put",
        200,
    )
    url = saved["member"]["avatarUrl"]
    kept = contract_response(put(client, payload(bio=None)), "put", 200)
    assert kept["member"]["avatarUrl"] == url
    assert kept["bio"] is None
    assert client.get(url).status_code == 200
    assert client.get("/api/media/avatars/unknown").status_code == 404


def test_failed_database_save_keeps_old_profile_and_removes_new_file(
    members, settings, monkeypatch
):
    client = browser(members[1])
    baseline = contract_response(
        put(client, payload(avatarAction="replace"), image()), "put", 200
    )
    old_files = set((settings.MEDIA_ROOT / "avatars").iterdir())

    def fail_save(*args, **kwargs):
        raise OSError("fictional persistence failure")

    monkeypatch.setattr(User, "save", fail_save)
    contract_response(
        put(client, payload(displayName="Changed", avatarAction="replace"), image()),
        "put",
        500,
    )
    assert contract_response(client.get(PATH), "get", 200) == baseline
    assert set((settings.MEDIA_ROOT / "avatars").iterdir()) == old_files
    assert client.get(baseline["member"]["avatarUrl"]).status_code == 200


def test_committed_removal_cleans_up_private_file(
    members, settings, django_capture_on_commit_callbacks
):
    client = browser(members[1])
    saved = contract_response(
        put(client, payload(avatarAction="replace"), image()), "put", 200
    )
    with django_capture_on_commit_callbacks(execute=True):
        contract_response(put(client, payload(avatarAction="remove")), "put", 200)
    assert list((settings.MEDIA_ROOT / "avatars").iterdir()) == []
    assert client.get(saved["member"]["avatarUrl"]).status_code == 404
