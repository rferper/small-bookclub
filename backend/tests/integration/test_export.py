"""Privileged HTTP ZIP export, fresh OAuth evidence and native media boundaries."""

import io
import json
import zipfile
from datetime import datetime, timedelta, timezone

import pytest
from django.test import Client
from django.utils import timezone as django_timezone
from jsonschema import Draft202012Validator

from books.catalogue import COVER_URL, cover_file
from books.models import Book, BookCompletion
from config.contract import read_contract, resolve
from core.models import ExportEvent, LiteraryQuote, PurgeRecord
from core.recycle import purge_target
from meetings.models import (
    Meeting,
    MeetingHighlight,
    ReadingAssignment,
    ReadingCompletion,
)
from reviews.constants import CRITERIA
from reviews.models import RatingRubric, Review
from users.authentication import EXPORT_KEY
from users.models import CuratorAssignment, User
from users.profile import AVATAR_URL, avatar_file
from votes.models import Vote, VoteApproval, VoteCandidate

pytestmark = [pytest.mark.integration, pytest.mark.django_db]
NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
DOC = read_contract()


@pytest.fixture
def world(monkeypatch, settings, tmp_path):
    monkeypatch.setattr(django_timezone, "now", lambda: NOW)
    settings.MEDIA_ROOT = tmp_path
    users = [
        User.objects.create_user(
            f"8300000000000000{i:02d}",
            approved=True,
            role="admin" if i == 0 else "member",
            display_name=f"Fictional member {i}",
        )
        for i in range(3)
    ]
    assignment = CuratorAssignment.objects.create(member=users[1])
    book = Book.objects.create(
        title="Fictional exported book",
        status="terminado",
        description="PRIVATE_BOOK",
        cover_path=COVER_URL + "a" * 32,
    )
    cover_file("a" * 32).parent.mkdir(parents=True)
    cover_file("a" * 32).write_bytes(b"fictional cover bytes")
    users[2].avatar_path = AVATAR_URL + "b" * 32
    users[2].bio = "PRIVATE_PROFILE"
    users[2].save(update_fields=["avatar_path", "bio"])
    avatar_file("b" * 32).parent.mkdir(parents=True)
    avatar_file("b" * 32).write_bytes(b"fictional avatar bytes")
    meeting = Meeting.objects.create(
        book=book, starts_at=NOW, summary_text="PRIVATE_DRAFT", attendance_recorded=True
    )
    meeting.attendees.add(users[1])
    week = ReadingAssignment.objects.create(
        book=book,
        meeting=meeting,
        week_number=1,
        percent_start=0,
        percent_end=25,
        page_start=1,
        page_end=42,
        notes="PRIVATE_WEEK",
    )
    ReadingCompletion.objects.create(assignment=week, member=users[1], completed_at=NOW)
    ReadingCompletion.objects.create(assignment=week, member=users[2])
    BookCompletion.objects.create(book=book, member=users[1], completed_at=NOW)
    BookCompletion.objects.create(book=book, member=users[2])
    highlight = MeetingHighlight.objects.create(
        meeting=meeting, position=1, text="PRIVATE_HIGHLIGHT", kind="quote"
    )
    highlight.speakers.add(users[2])
    highlight.soft_delete(users[0])
    Review.objects.create(
        book=book,
        member=users[1],
        text="PRIVATE_REVIEW",
        **dict.fromkeys(CRITERIA, 4.5),
    )
    vote = Vote.objects.create(
        curator_assignment=assignment,
        status="closed",
        opened_at=NOW - timedelta(days=2),
        closed_at=NOW - timedelta(days=1),
        winning_book=book,
        tie_note="PRIVATE_TIE_NOTE",
    )
    candidate = VoteCandidate.objects.create(vote=vote, book=book, position=1)
    VoteApproval.objects.create(
        candidate=candidate, member=users[1], approved_at=NOW - timedelta(days=1)
    )
    book.origin_vote = vote
    book.save(update_fields=["origin_vote"])
    book.soft_delete(users[0])
    LiteraryQuote.objects.create(text="PRIVATE_QUOTE")
    purged = LiteraryQuote.objects.create(text="PURGED_PRIVATE_QUOTE")
    purged.soft_delete(users[0])
    purged_id = str(purged.pk)
    purge_target("quote", purged, users[0])
    RatingRubric.objects.update_or_create(
        criterion="disfrute",
        star=1,
        defaults={"description": "Fictional rubric anchor"},
    )
    User.objects.filter(pk=users[2].pk).update(approved=False, revoked_at=NOW)
    return users, book, week, meeting, purged_id


def browser(actor=None, fresh=True):
    client = Client(enforce_csrf_checks=True)
    if actor:
        client.force_login(actor)
        if fresh:
            session = client.session
            session[EXPORT_KEY] = {
                "id": str(actor.pk),
                "discord": actor.discord_user_id,
                "at": NOW.timestamp(),
            }
            session.save()
    client.get("/api/session")
    return client


def request(client, status=200, csrf=True, **kwargs):
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    response = client.post("/api/admin/export", **headers, **kwargs)
    assert response.status_code == status, response.content[:400]
    if status != 200:
        schema = resolve(
            DOC, DOC["paths"]["/api/admin/export"]["post"]["responses"][str(status)]
        )["content"]["application/json"]["schema"]
        Draft202012Validator(schema).validate(response.json())
        assert "PRIVATE" not in response.content.decode()
        assert "Content-Disposition" not in response
    return response


def unpack(response):
    assert response["Content-Type"] == "application/zip"
    assert response["Cache-Control"] == "no-store"
    assert (
        response["Content-Disposition"] == 'attachment; filename="club-de-lectura.zip"'
    )
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert archive.testzip() is None
        files = {name: archive.read(name) for name in archive.namelist()}
    manifest, records = (
        json.loads(files[name]) for name in ["manifest.json", "club.json"]
    )
    for name, data in [("ExportManifest", manifest), ("ClubBusinessExport", records)]:
        Draft202012Validator(resolve(DOC, DOC["components"]["schemas"][name])).validate(
            data
        )
    assert manifest["media"] == records["media"]
    return files, records


@pytest.mark.parametrize("identity,status", [(None, 401), (1, 403), (2, 401)])
def test_export_denies_non_admins_before_building_data(
    world, monkeypatch, identity, status
):
    from core import export

    users, *_ = world

    def forbidden(*args):
        pytest.fail("Private export projection called for unauthorized actor")

    monkeypatch.setattr(export, "business_projection", forbidden)
    request(browser(users[identity] if identity is not None else None), status)


def test_pending_and_demoted_admin_and_csrf_cannot_export(world):
    users, *_ = world
    client = browser(users[0])
    request(client, 403, csrf=False)
    User.objects.filter(pk=users[0].pk).update(role="member")
    request(client, 403)
    User.objects.filter(pk=users[0].pk).update(role="admin", approved=False)
    request(client, 401)


@pytest.mark.parametrize(
    "stamp,status", [(0, 200), (299.999, 200), (300, 409), (301, 409), (-1, 409)]
)
def test_exact_same_admin_server_freshness_boundary(world, stamp, status):
    users, *_ = world
    client = browser(users[0])
    session = client.session
    session[EXPORT_KEY]["at"] = NOW.timestamp() - stamp
    session.save()
    response = request(client, status)
    if status == 200:
        unpack(response)
    else:
        assert response.json()["code"] == "reauthentication_required"
        assert client.get("/api/session").json()["status"] == "signedIn"


@pytest.mark.parametrize(
    "record",
    [
        None,
        {"id": "wrong", "discord": "830000000000000000", "at": NOW.timestamp()},
        {"id": "1", "discord": "wrong", "at": NOW.timestamp()},
        {"id": "1", "discord": "830000000000000000", "at": True},
    ],
)
def test_missing_mismatched_or_invalid_evidence_rejects_confirmation(world, record):
    users, *_ = world
    client = browser(users[0], fresh=False)
    session = client.session
    session[EXPORT_KEY] = record
    session.save()
    response = request(
        client,
        409,
        data=json.dumps({"confirmed": True, "userId": str(users[0].pk)}),
        content_type="application/json",
    )
    assert response.json()["code"] == "reauthentication_required"


def test_full_whitelisted_archive_preserves_private_retained_business_and_media(world):
    users, book, week, meeting, purged_id = world
    files, records = unpack(request(browser(users[0])))
    exported_book = next(row for row in records["books"] if row["id"] == str(book.pk))
    assert exported_book["deletion"]["deletedBy"] == str(users[0].pk)
    assert exported_book["description"] == "PRIVATE_BOOK"
    assert exported_book["originVote"]["id"] == records["votes"][0]["id"]
    assert records["meetings"][0]["summary"] == {
        "text": "PRIVATE_DRAFT",
        "published": False,
    }
    assert records["meetings"][0]["highlights"][0]["text"] == "PRIVATE_HIGHLIGHT"
    assert records["meetings"][0]["highlights"][0]["removedPosition"] == 0
    assert records["meetings"][0]["attendance"] == [str(users[1].pk)]
    assert records["weeks"][0]["notes"] == "PRIVATE_WEEK"
    assert records["reviews"][0]["text"] == "PRIVATE_REVIEW"
    assert records["votes"][0]["candidates"][0]["approverIds"] == [str(users[1].pk)]
    assert records["votes"][0]["outcome"]["tieNote"] == "PRIVATE_TIE_NOTE"
    assert records["completions"] == [
        {"weekId": str(week.pk), "memberIds": [str(users[1].pk)]}
    ]
    assert records["finished"] == [
        {"bookId": str(book.pk), "memberIds": [str(users[1].pk)]}
    ]
    assert records["members"][2]["status"] == "revoked"
    assert records["profiles"][2]["bio"] == "PRIVATE_PROFILE"
    assert records["tombstones"][0]["id"] == purged_id
    assert records["rubric"]["disfrute"]["1"] == "Fictional rubric anchor"
    assert files["media/cover-" + "a" * 32 + ".webp"] == b"fictional cover bytes"
    assert files["media/avatar-" + "b" * 32 + ".webp"] == b"fictional avatar bytes"
    raw = files["club.json"].decode()
    for excluded in [
        "PURGED_PRIVATE_QUOTE",
        "password",
        "session_key",
        "access_token",
        "SECRET_KEY",
        "club_export_auth",
        "cover_path",
        "avatar_path",
    ]:
        assert excluded not in raw
    assert User.objects.count() == 3 and PurgeRecord.objects.count() == 1


def test_missing_external_traversal_and_symlink_media_are_not_read(world, monkeypatch):
    users, book, *_ = world
    cover_file("a" * 32).unlink()
    User.objects.filter(pk=users[0].pk).update(
        avatar_path="https://invalid.example/private-token"
    )
    User.objects.filter(pk=users[1].pk).update(avatar_path=AVATAR_URL + "../../outside")
    _, records = unpack(request(browser(users[0])))
    assert records["media"][1]["available"] is False
    assert records["media"][1]["path"] is None
    assert records["members"][0]["avatarMediaId"] is None
    assert records["members"][1]["avatarMediaId"] is None
    from pathlib import Path

    real = Path.is_symlink
    monkeypatch.setattr(
        Path, "is_symlink", lambda path: path == avatar_file("b" * 32) or real(path)
    )
    files, records = unpack(request(browser(users[0])))
    assert set(files) == {"manifest.json", "club.json"}
    assert all(not row["available"] for row in records["media"])


def test_backups_metadata_remains_truthful_and_admin_only(world):
    users, *_ = world
    client = browser(users[0])
    response = client.get("/api/admin/backups")
    assert response.status_code == 200 and response.json() == {
        "policy": "pending",
        "lastBackupAt": None,
    }
    schema = resolve(DOC, DOC["components"]["schemas"]["BackupInfo"])
    Draft202012Validator(schema).validate(response.json())
    assert browser(users[1]).get("/api/admin/backups").status_code == 403
    assert browser().get("/api/admin/backups").status_code == 401


def test_projection_error_returns_safe_error_without_download(world, monkeypatch):
    from core import export

    def fail(*args):
        raise RuntimeError("PRIVATE_REVIEW PRIVATE_PROFILE")

    monkeypatch.setattr(export, "business_projection", fail)
    request(browser(world[0][0]), 500)
    assert not ExportEvent.objects.exists()


def test_empty_club_export_and_repeated_success_have_exactly_one_event_per_request(
    monkeypatch,
):
    monkeypatch.setattr(django_timezone, "now", lambda: NOW)
    admin = User.objects.create_user(
        "830000000000000099",
        approved=True,
        role="admin",
        display_name="Fictional empty admin",
    )
    client = browser(admin)
    _, first = unpack(request(client))
    for key in (
        "books",
        "weeks",
        "meetings",
        "completions",
        "finished",
        "reviews",
        "votes",
        "tombstones",
        "media",
    ):
        assert first[key] == []
    assert len(first["audit"]) == ExportEvent.objects.count() == 1
    _, second = unpack(request(client))
    assert len(second["audit"]) == ExportEvent.objects.count() == 2
    assert len({row["id"] for row in second["audit"]}) == 2
    assert all(
        row["target"] == {"type": "club", "id": "club", "label": "Club de lectura"}
        for row in second["audit"]
    )


def test_reauthentication_refusal_creates_no_export_event(world):
    request(browser(world[0][0], fresh=False), 409)
    assert not ExportEvent.objects.exists()
