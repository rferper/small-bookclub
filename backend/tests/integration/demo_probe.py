"""Isolated Django startup probe; invoked by test_demo, never reload global routers."""

import json

import django

django.setup()

from allauth.socialaccount.internal import statekit  # noqa: E402
from django.conf import settings  # noqa: E402
from django.contrib.auth import SESSION_KEY  # noqa: E402
from django.contrib.sessions.models import Session  # noqa: E402
from django.core.management import call_command  # noqa: E402
from django.test import Client  # noqa: E402
from django.utils import timezone  # noqa: E402
from jsonschema import Draft202012Validator  # noqa: E402

from books.models import Book  # noqa: E402
from config.api import api  # noqa: E402
from config.contract import check_schema, implemented_operations, read_contract, resolve  # noqa: E402
from core.models import DemoInstallation  # noqa: E402
from meetings.models import Meeting, ReadingAssignment  # noqa: E402
from users.authentication import EXPORT_KEY, INTENT_KEY, PURPOSE_KEY  # noqa: E402
from users.demo import DEMO_DISCORD_ID  # noqa: E402
from users.models import CuratorAssignment, User  # noqa: E402

call_command("migrate", verbosity=0)
document = read_contract()
check_schema(document, api.get_openapi_schema(), implemented_operations(api))


def check(response, path, method="get", status=200):
    assert response.status_code == status, (
        path,
        response.status_code,
        response.content,
    )
    shape = resolve(document, document["paths"][path][method]["responses"][str(status)])
    if status == 204:
        assert response.content == b""
    else:
        Draft202012Validator(shape["content"]["application/json"]["schema"]).validate(
            response.json()
        )
    return response


client = Client(enforce_csrf_checks=True)
mounted = ("/api/auth/demo", "post") in implemented_operations(api)
assert mounted is settings.DEMO_MODE
assert ("/api/auth/demo" in api.get_openapi_schema()["paths"]) is settings.DEMO_MODE
assert (
    check(client.get("/api/session"), "/api/session").json()["demoSignInAvailable"]
    is False
)
if not settings.DEMO_MODE:
    assert client.post("/api/auth/demo").status_code == 404
    assert not DemoInstallation.objects.exists()
    assert not User.objects.exists()
else:

    def post(path="/api/auth/demo", **kwargs):
        return client.post(
            path, HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value, **kwargs
        )

    check(client.post("/api/auth/demo"), "/api/auth/demo", "post", 403)
    check(post(), "/api/auth/demo", "post", 404)
    call_command("seed_demo", verbosity=0)
    assert (
        check(client.get("/api/session"), "/api/session").json()["demoSignInAvailable"]
        is True
    )
    target = User.objects.get(discord_user_id=DEMO_DISCORD_ID)
    assert User.objects.count() == 6
    assert not User.objects.filter(role="admin").exists()
    admin = User.objects.create_user(
        "100000000000000001",
        display_name="Fictional prior admin",
        role="admin",
        approved=True,
    )
    client.force_login(admin)
    session = client.session
    session[EXPORT_KEY] = {
        "id": str(admin.pk),
        "discord": admin.discord_user_id,
        "at": timezone.now().timestamp(),
    }
    session[INTENT_KEY] = {"purpose": "export"}
    session[PURPOSE_KEY] = "export"
    session[statekit.STATES_SESSION_KEY] = {"fictional": True}
    session["unrelated_old_state"] = True
    session.save()
    old_key = session.session_key
    claims = {
        "role": "admin",
        "userId": str(admin.pk),
        "discord_user_id": admin.discord_user_id,
    }
    check(
        post(data=json.dumps(claims), content_type="application/json"),
        "/api/auth/demo",
        "post",
        204,
    )
    assert client.session.session_key != old_key
    assert not Session.objects.filter(session_key=old_key).exists()
    assert client.session[SESSION_KEY] == str(target.pk)
    for key in [
        EXPORT_KEY,
        INTENT_KEY,
        PURPOSE_KEY,
        statekit.STATES_SESSION_KEY,
        "unrelated_old_state",
    ]:
        assert key not in client.session
    assert (
        check(client.get("/api/session"), "/api/session").json()["user"]["role"]
        == "member"
    )
    check(client.get("/api/admin/members"), "/api/admin/members", status=403)
    check(post("/api/admin/export"), "/api/admin/export", "post", 403)
    finished = Book.objects.get(status="terminado")
    meeting = Meeting.objects.first()
    week = ReadingAssignment.objects.get(meeting=meeting)

    def ratings():
        return check(
            client.get(f"/api/books/{finished.pk}/ratings"),
            "/api/books/{bookId}/ratings",
        )

    assert "ficticia de una lectura compartida" not in ratings().content.decode()
    assert (
        "Resumen ficticio"
        not in client.get(f"/api/meetings/{meeting.pk}").content.decode()
    )

    def put(path, data):
        return client.put(
            path,
            data=json.dumps(data),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
        )

    check(
        put(f"/api/weeks/{week.pk}/completion", {"completed": True}),
        "/api/weeks/{weekId}/completion",
        "put",
        204,
    )
    assert (
        "Resumen ficticio" in client.get(f"/api/meetings/{meeting.pk}").content.decode()
    )
    check(
        put(f"/api/books/{finished.pk}/finished", {"finished": True}),
        "/api/books/{bookId}/finished",
        "put",
    )
    assert "ficticia de una lectura compartida" not in ratings().content.decode()
    scores = dict.fromkeys(["disfrute", "estilo", "personajes", "trama", "huella"], 4)
    check(
        put(
            f"/api/books/{finished.pk}/my-review",
            {"scores": scores, "text": "Mi reseña ficticia"},
        ),
        "/api/books/{bookId}/my-review",
        "put",
    )
    assert "ficticia de una lectura compartida" in ratings().content.decode()
    target.display_name = "Edición de una visita ficticia"
    target.save()
    before = (User.objects.count(), Book.objects.count(), client.session.session_key)
    call_command("seed_demo", verbosity=0)
    target.refresh_from_db()
    assert target.display_name == "Edición de una visita ficticia"
    assert before == (
        User.objects.count(),
        Book.objects.count(),
        client.session.session_key,
    )
    check(post("/api/auth/logout"), "/api/auth/logout", "post", 204)
    for mutation in ["revoked", "admin", "curator", "missing_target", "missing_marker"]:
        CuratorAssignment.objects.filter(member=target, current=True).update(
            current=False, ended_at=timezone.now()
        )
        target.approved = mutation != "revoked"
        target.role = "admin" if mutation == "admin" else "member"
        target.save()
        if mutation == "curator":
            CuratorAssignment.objects.update(current=False, ended_at=timezone.now())
            CuratorAssignment.objects.create(member=target)
        if mutation == "missing_marker":
            DemoInstallation.objects.all().delete()
        if mutation == "missing_target":
            User.objects.filter(pk=target.pk).update(
                discord_user_id="990000000000000099"
            )
        check(post(), "/api/auth/demo", "post", 404)
        assert client.get("/api/session").json()["demoSignInAvailable"] is False
    # Shared peer budget bounds unauthenticated demo login attempts too.
    for _ in range(31):
        response = post()
        if response.status_code == 429:
            check(response, "/api/auth/demo", "post", 429)
            assert int(response["Retry-After"]) >= 1
            break
    else:
        raise AssertionError("demo login must be rate limited")
