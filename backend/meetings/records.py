"""Transactional admin record editing, with plain text and retained attribution."""

import json

from django.core.exceptions import SuspiciousOperation
from django.db import transaction

from users.access import require_permission
from users.directory import member_summary
from users.membership import error_result, native_member_id, spanish_name_key
from users.models import User

from .calendar import locked_actor_refusal, lookup
from .models import MeetingHighlight, ReadingAssignment


class InvalidRecordInput(ValueError):
    """A rejected payload, distinct from storage/programming failures."""


def named_members(rows):
    return [
        member_summary(row)
        for row in sorted(
            rows, key=lambda row: (spanish_name_key(row.display_name), row.pk)
        )
    ]


def projection(meeting):
    week = ReadingAssignment.all_objects.filter(meeting=meeting).first()
    book = meeting.book if meeting.book_id and meeting.book.deleted_at is None else None
    return {
        "id": str(meeting.pk),
        "startsAt": meeting.starts_at,
        "cancelled": meeting.cancelled,
        "book": {
            "id": str(book.pk),
            "title": book.title,
            "authors": book.authors,
            "coverUrl": book.cover_path or None,
        }
        if book
        else None,
        "week": {
            "id": str(week.pk),
            "weekNumber": week.week_number,
            "removed": week.deleted_at is not None,
        }
        if week
        else None,
        "markedSafe": meeting.record_safe,
        "summary": {
            "text": meeting.summary_text,
            "published": meeting.summary_published,
        }
        if meeting.summary_text
        else None,
        "highlights": [
            {
                "id": str(row.pk),
                "text": row.text,
                "kind": row.kind,
                "published": row.published,
                "speakerIds": [
                    str(pk)
                    for pk in row.speakers.order_by("pk").values_list("pk", flat=True)
                ],
                "speakers": named_members(row.speakers.all()),
            }
            for row in meeting.highlights.order_by("position", "pk")
        ],
        "speakerOptions": named_members(
            User.objects.filter(approved=True, revoked_at=None)
        ),
    }


@require_permission("manage_meetings")
def read_record(request, meeting_id):
    meeting = lookup(meeting_id)
    return (200, projection(meeting)) if meeting else error_result(404)


def payload(request):
    try:
        if request.content_type == "application/json" and len(request.body) <= 131072:
            return json.loads(request.body)
    except (ValueError, UnicodeDecodeError, SuspiciousOperation):
        pass
    return None


def text(value, limit, required=False):
    if not isinstance(value, str) or "\x00" in value:
        raise InvalidRecordInput
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        raise InvalidRecordInput from None
    value = value.strip()
    if len(value) > limit or (required and not value):
        raise InvalidRecordInput
    return value


def ids(value):
    if not isinstance(value, list) or any(
        not isinstance(key, str) or not native_member_id(key) for key in value
    ):
        raise InvalidRecordInput
    keys = [native_member_id(key) for key in value]
    if len(set(keys)) != len(keys):
        raise InvalidRecordInput
    return keys


@transaction.atomic
@require_permission("manage_meetings")
def mutate_record(request, meeting_id, action, highlight_id=None):
    refusal = locked_actor_refusal(request)
    if refusal:
        return error_result(refusal)
    meeting = lookup(meeting_id, lock=True)
    if meeting is None:
        return error_result(404)
    highlight = None
    if action in {"update", "remove"}:
        key = native_member_id(highlight_id)
        highlight = (
            MeetingHighlight.objects.select_for_update()
            .filter(meeting=meeting, pk=key)
            .first()
            if key
            else None
        )
        if highlight is None:
            return error_result(404)
    if (
        action == "safe"
        and ReadingAssignment.all_objects.filter(meeting=meeting).exists()
    ):
        return error_result(409)
    if action == "remove":
        highlight.soft_delete(request.user)
        return 200, projection(meeting)
    value = payload(request)
    if not isinstance(value, dict):
        return error_result(400)
    try:
        if action == "summary":
            if (
                set(value) != {"text", "published"}
                or type(value["published"]) is not bool
            ):
                raise InvalidRecordInput
            clean = text(value["text"], 10000, value["published"])
            previously_published = meeting.summary_published
            meeting.summary_text = clean or None
            meeting.summary_published = value["published"]
            meeting.save(
                update_fields=["summary_text", "summary_published", "updated_at"]
            )
            if meeting.summary_published and not previously_published:
                from core.activity import record_event

                record_event("summary_published", request.user, meeting=meeting)
        elif action == "safe":
            if set(value) != {"safe"} or type(value["safe"]) is not bool:
                raise InvalidRecordInput
            meeting.record_safe = value["safe"]
            meeting.save(update_fields=["record_safe", "updated_at"])
        elif action == "order":
            if set(value) != {"ids"}:
                raise InvalidRecordInput
            keys = ids(value["ids"])
            rows = list(
                meeting.highlights.select_for_update().order_by("position", "pk")
            )
            if set(keys) != {row.pk for row in rows}:
                raise InvalidRecordInput
            # Vacate all active positions before assigning the exact permutation.
            reserved = set(
                MeetingHighlight.all_objects.filter(
                    meeting=meeting, deleted_at__isnull=False
                ).values_list("position", flat=True)
            )
            offset = max([row.position for row in rows] + list(reserved), default=0) + 1
            for index, row in enumerate(rows):
                row.position = offset + index
                row.save(update_fields=["position"])
            by_id = {row.pk: row for row in rows}
            position = 0
            for key in keys:
                position += 1
                while position in reserved:
                    position += 1
                row = by_id[key]
                row.position = position
                row.save(update_fields=["position"])
        elif action in {"create", "update"}:
            if (
                set(value) != {"text", "kind", "speakerIds", "published"}
                or type(value["published"]) is not bool
                or value["kind"] not in ["quote", "paraphrase"]
            ):
                raise InvalidRecordInput
            clean = text(value["text"], 2000, True)
            keys = ids(value["speakerIds"])
            selected = list(User.objects.select_for_update().filter(pk__in=keys))
            previous = (
                set(highlight.speakers.values_list("pk", flat=True))
                if highlight
                else set()
            )
            if len(selected) != len(keys) or any(
                not (row.approved and row.revoked_at is None)
                and not (row.pk in previous and row.revoked_at is not None)
                for row in selected
            ):
                raise InvalidRecordInput
            if highlight is None:
                last = (
                    MeetingHighlight.all_objects.filter(meeting=meeting)
                    .order_by("-position")
                    .first()
                )
                highlight = MeetingHighlight(
                    meeting=meeting, position=last.position + 1 if last else 1
                )
            highlight.text = clean
            highlight.kind = value["kind"]
            highlight.published = value["published"]
            highlight.save()
            highlight.speakers.set(selected)
        else:
            raise InvalidRecordInput
    except InvalidRecordInput:
        return error_result(400)
    return (201 if action == "create" else 200), projection(meeting)
