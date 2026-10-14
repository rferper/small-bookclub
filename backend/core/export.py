"""Privileged whitelisted business export; never a database/session serializer."""

import io
import json
import zipfile
from pathlib import Path

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone

from books.catalogue import METADATA_FIELDS, cover_file, cover_key
from books.models import Book
from meetings.calendar import locked_actor_refusal
from meetings.models import (
    Meeting,
    MeetingHighlight,
    ReadingAssignment,
)
from reviews.models import Review
from reviews.rubric import projection as rubric_projection
from users.access import require_permission
from users.authentication import has_fresh_export_auth
from users.membership import error_result
from users.models import CuratorAssignment, User
from users.profile import avatar_file, stored_avatar_key
from votes.models import Vote

from .audit import audit_projection, record_audit
from .models import LiteraryQuote, PurgeRecord


def native_id(value):
    return str(value) if value is not None else None


def deletion(row):
    return (
        {
            "deletedAt": row.deleted_at,
            "deletedBy": str(row.deleted_by_id),
            "purgeDueAt": row.purge_due_at,
        }
        if row.deleted_at
        else None
    )


class Media:
    def __init__(self):
        self.entries = {}
        self.files = {}

    def add(self, area, key):
        if key is None:
            return None
        identifier = f"{area}-{key}"
        if identifier in self.entries:
            return identifier
        file = cover_file(key) if area == "cover" else avatar_file(key)
        expected_parent = Path(settings.MEDIA_ROOT).resolve() / (
            "covers" if area == "cover" else "avatars"
        )
        data = None
        try:
            # Even a valid opaque pointer must not read symlinks outside private media.
            if not file.is_symlink() and file.resolve().parent == expected_parent:
                data = file.read_bytes()
        except (OSError, RuntimeError):
            pass
        path = f"media/{identifier}.webp" if data is not None else None
        self.entries[identifier] = {
            "id": identifier,
            "path": path,
            "contentType": "image/webp",
            "available": data is not None,
        }
        if path:
            self.files[path] = data
        return identifier


def business_projection(media, now):
    members = list(User.objects.order_by("pk"))
    books = list(
        Book.all_objects.select_related(
            "origin_vote__curator_assignment__member"
        ).order_by("pk")
    )
    weeks = list(ReadingAssignment.all_objects.order_by("book_id", "week_number", "pk"))
    meetings = list(Meeting.all_objects.order_by("pk"))
    assignment = CuratorAssignment.objects.filter(current=True).first()
    result = {
        "schemaVersion": 1,
        "createdAt": now,
        "curatorId": native_id(assignment.member_id) if assignment else None,
        "members": [
            {
                "id": str(row.pk),
                "displayName": row.display_name,
                "role": row.role,
                "status": "active" if row.is_active else "revoked",
                "avatarMediaId": media.add(
                    "avatar", stored_avatar_key(row.avatar_path)
                ),
            }
            for row in members
        ],
        "allowlist": [
            {
                "memberId": str(row.pk),
                "discordId": row.discord_user_id,
                "addedAt": row.created_at,
                "revokedAt": row.revoked_at,
            }
            for row in members
        ],
        "profiles": [
            {
                "memberId": str(row.pk),
                "bio": row.bio,
                "favouriteQuote": row.favourite_quote,
                "favouriteBookIds": [
                    str(pk)
                    for pk in row.favourites.order_by("rank", "pk").values_list(
                        "book_id", flat=True
                    )
                ],
            }
            for row in members
        ],
        "books": [],
        "weeks": [],
        "meetings": [],
        "votes": [],
        "completions": [
            {
                "weekId": str(row.pk),
                "memberIds": [
                    str(pk)
                    for pk in row.completions.filter(completed_at__isnull=False)
                    .order_by("member_id")
                    .values_list("member_id", flat=True)
                ],
            }
            for row in weeks
        ],
        "finished": [
            {
                "bookId": str(row.pk),
                "memberIds": [
                    str(pk)
                    for pk in row.completions.filter(completed_at__isnull=False)
                    .order_by("member_id")
                    .values_list("member_id", flat=True)
                ],
            }
            for row in books
        ],
        "reviews": [
            {
                "bookId": str(row.book_id),
                "userId": str(row.member_id),
                "scores": {key: float(score) for key, score in row.scores.items()},
                "text": row.text,
                "submittedAt": row.submitted_at,
                "editedAt": row.edited_at,
            }
            for row in Review.objects.order_by("pk")
        ],
        "quotes": [
            {
                "id": str(row.pk),
                "text": row.text,
                "author": row.author,
                "source": row.source,
                "active": row.active,
                "deletion": deletion(row),
            }
            for row in LiteraryQuote.all_objects.order_by("pk")
        ],
        "tombstones": [
            {
                "type": row.kind,
                "id": row.resource_id,
                "purgedAt": row.purged_at,
                "purgedBy": str(row.actor_id),
            }
            for row in PurgeRecord.objects.order_by("pk")
        ],
        "audit": audit_projection(),
        "rubric": rubric_projection(),
    }
    for row in books:
        origin = row.origin_vote
        curator_name = origin.curator_assignment.member.display_name if origin else None
        result["books"].append(
            {
                "id": str(row.pk),
                **{
                    wire: getattr(row, field) for wire, field in METADATA_FIELDS.items()
                },
                "originVote": {
                    "id": str(origin.pk),
                    "label": f"Votación de {curator_name}",
                }
                if origin
                else None,
                "coverMediaId": media.add("cover", cover_key(row.cover_path)),
                "deletion": deletion(row),
            }
        )
    for row in weeks:
        result["weeks"].append(
            {
                "id": str(row.pk),
                "bookId": str(row.book_id),
                "weekNumber": row.week_number,
                "percentStart": row.percent_start,
                "percentEnd": row.percent_end,
                "pageStart": row.page_start,
                "pageEnd": row.page_end,
                "dueDate": row.due_date,
                "notes": row.notes,
                "meetingId": native_id(row.meeting_id),
                "deletion": deletion(row),
            }
        )
    for row in meetings:
        result["meetings"].append(
            {
                "id": str(row.pk),
                "bookId": native_id(row.book_id),
                "startsAt": row.starts_at,
                "cancelled": row.cancelled,
                "markedSafe": row.record_safe,
                "attendance": [
                    str(pk)
                    for pk in row.attendees.order_by("pk").values_list("pk", flat=True)
                ]
                if row.attendance_recorded
                else None,
                "summary": {
                    "text": row.summary_text,
                    "published": row.summary_published,
                }
                if row.summary_text is not None
                else None,
                "highlights": [
                    {
                        "id": str(item.pk),
                        "text": item.text,
                        "kind": item.kind,
                        "published": item.published,
                        "speakerIds": [
                            str(pk)
                            for pk in item.speakers.order_by("pk").values_list(
                                "pk", flat=True
                            )
                        ],
                        "removedPosition": item.position - 1
                        if item.deleted_at
                        else None,
                        "deletion": deletion(item),
                    }
                    for item in MeetingHighlight.all_objects.filter(
                        meeting=row
                    ).order_by("position", "pk")
                ],
                "deletion": deletion(row),
            }
        )
    for row in Vote.objects.select_related("curator_assignment").order_by("pk"):
        candidates = [
            {
                "bookId": str(item.book_id),
                "approverIds": [
                    str(pk)
                    for pk in item.approvals.order_by("member_id").values_list(
                        "member_id", flat=True
                    )
                ],
            }
            for item in row.candidates.order_by("position", "pk")
        ]
        outcome = None
        if row.status == "closed":
            if row.winning_book_id:
                outcome = {
                    "winnerBookId": str(row.winning_book_id),
                    "tieNote": row.tie_note,
                }
            else:
                maximum = max(
                    (len(item["approverIds"]) for item in candidates), default=0
                )
                outcome = {
                    "tiedBookIds": [
                        item["bookId"]
                        for item in candidates
                        if len(item["approverIds"]) == maximum
                    ]
                }
        result["votes"].append(
            {
                "id": str(row.pk),
                "status": row.status,
                "curatorId": str(row.curator_assignment.member_id),
                "openedAt": row.opened_at,
                "closedAt": row.closed_at,
                "candidates": candidates,
                "outcome": outcome,
            }
        )
    result["media"] = list(media.entries.values())
    return result


@require_permission("restore_content")
def backup_info(request):
    return 200, {"policy": "pending", "lastBackupAt": None}


@transaction.atomic
@require_permission("restore_content")
def export_club(request):
    refusal = locked_actor_refusal(request)
    if refusal:
        return error_result(refusal)
    if not has_fresh_export_auth(request):
        return 409, {
            "code": "reauthentication_required",
            "message": "Vuelve a identificarte con Discord para exportar los datos.",
        }
    media = Media()
    record_audit("exported", request.user, "club", "club")
    records = business_projection(media, timezone.now())
    manifest = {key: records[key] for key in ("schemaVersion", "createdAt", "media")}
    manifest["recordsFile"] = "club.json"
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in (("manifest.json", manifest), ("club.json", records)):
            archive.writestr(
                name,
                json.dumps(data, cls=DjangoJSONEncoder, ensure_ascii=False).encode(
                    "utf-8"
                ),
            )
        for name, data in media.files.items():
            archive.writestr(name, data)
    response = HttpResponse(buffer.getvalue(), content_type="application/zip")
    response["Content-Disposition"] = 'attachment; filename="club-de-lectura.zip"'
    response["Cache-Control"] = "no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
