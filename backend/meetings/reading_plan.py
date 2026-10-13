"""Atomic manual plans; the assignment owns the sole retained meeting link."""

import json
from datetime import date

from django.core.exceptions import SuspiciousOperation, ValidationError
from django.db import IntegrityError, transaction

from books.models import Book
from users.access import require_permission
from users.membership import error_result, native_member_id

from .calendar import locked_actor_refusal
from .models import Meeting, ReadingAssignment
from .reading_rules import clean_input, warnings


def facts(row):
    return {
        "percentStart": row.percent_start,
        "percentEnd": row.percent_end,
        "pageStart": row.page_start,
        "pageEnd": row.page_end,
        "dueDate": row.due_date,
        "notes": row.notes,
        "meetingId": str(row.meeting_id) if row.meeting_id else None,
    }


def active_weeks(book):
    return list(
        ReadingAssignment.objects.filter(book=book)
        .select_related("meeting")
        .order_by("week_number", "pk")
    )


def projection(book):
    weeks = []
    for row in active_weeks(book):
        value = {
            **facts(row),
            "id": str(row.pk),
            "weekNumber": row.week_number,
            "completionCount": row.completions.filter(
                completed_at__isnull=False
            ).count(),
        }
        if row.meeting_id and row.meeting.deleted_at is not None:
            value["removedMeeting"] = True
        weeks.append(value)
    return {
        "book": {"id": str(book.pk), "title": book.title, "pageCount": book.page_count},
        "weeks": weeks,
        "meetings": [
            {"id": str(row.pk), "startsAt": row.starts_at, "cancelled": row.cancelled}
            for row in Meeting.objects.filter(book=book).order_by("starts_at", "pk")
        ],
    }


def lookup_book(book_id, *, lock=False):
    key = native_member_id(book_id)
    rows = Book.objects.select_for_update() if lock else Book.objects.all()
    return rows.filter(pk=key).first() if key else None


def read_json(request, keys):
    if request.content_type != "application/json" or len(request.body) > 65536:
        raise ValueError("Invalid reading request")
    value = json.loads(request.body)
    if (
        not isinstance(value, dict)
        or set(value) != keys
        or type(value.get("acknowledged")) is not bool
    ):
        raise ValueError("Invalid request fields")
    return value


@require_permission("manage_meetings")
def read_plan(request, book_id):
    book = lookup_book(book_id)
    return (200, projection(book)) if book else error_result(404)


def renumber(rows):
    # Move out of the old unique slots before installing the exact new order.
    offset = max((row.week_number for row in rows), default=0) + len(rows)
    for index, row in enumerate(rows, 1):
        ReadingAssignment.objects.filter(pk=row.pk).update(week_number=offset + index)
    for index, row in enumerate(rows, 1):
        ReadingAssignment.objects.filter(pk=row.pk).update(week_number=index)
        row.week_number = index


@transaction.atomic
@require_permission("manage_meetings")
def save_week(request, book_id, week_id=None):
    refusal = locked_actor_refusal(request)
    if refusal:
        return error_result(refusal)
    book = lookup_book(book_id, lock=True)
    if not book:
        return error_result(404)
    rows = active_weeks(book)
    existing = (
        next((row for row in rows if str(row.pk) == week_id), None)
        if week_id is not None
        else None
    )
    if week_id is not None and existing is None:
        return error_result(404)
    try:
        body = read_json(request, {"input", "acknowledged"})
        value = clean_input(body["input"])
    except (ValueError, UnicodeDecodeError, SuspiciousOperation, OverflowError):
        return error_result(400)
    meeting_key = (
        native_member_id(value["meetingId"]) if value["meetingId"] is not None else None
    )
    meeting = None
    if value["meetingId"] is not None:
        retained = existing is not None and meeting_key == existing.meeting_id
        manager = Meeting.all_objects if retained else Meeting.objects
        meeting = (
            manager.select_for_update().filter(pk=meeting_key).first()
            if meeting_key
            else None
        )
        if meeting is None:
            return error_result(404)
        if meeting.book_id != book.pk:
            return error_result(400)
        reservations = ReadingAssignment.all_objects.filter(meeting=meeting)
        if existing:
            reservations = reservations.exclude(pk=existing.pk)
        if reservations.exists():
            return error_result(409)
    proposed = (
        [value if row == existing else facts(row) for row in rows]
        if existing
        else [*[facts(row) for row in rows], value]
    )
    if warnings(proposed, book.page_count) and not body["acknowledged"]:
        return error_result(400)
    row = existing or ReadingAssignment(book=book, week_number=len(rows) + 1)
    for wire, field in [
        ("percentStart", "percent_start"),
        ("percentEnd", "percent_end"),
        ("pageStart", "page_start"),
        ("pageEnd", "page_end"),
        ("notes", "notes"),
    ]:
        setattr(row, field, value[wire])
    row.due_date = date.fromisoformat(value["dueDate"]) if value["dueDate"] else None
    row.meeting = meeting
    try:
        with transaction.atomic():
            row.full_clean()
            row.save()
    except (ValidationError, IntegrityError):
        return error_result(409)
    return (200 if existing else 201), projection(book)


@transaction.atomic
@require_permission("manage_meetings")
def reorder_weeks(request, book_id):
    refusal = locked_actor_refusal(request)
    if refusal:
        return error_result(refusal)
    book = lookup_book(book_id, lock=True)
    if not book:
        return error_result(404)
    try:
        body = read_json(request, {"ids", "acknowledged"})
        ids = body["ids"]
        if (
            not isinstance(ids, list)
            or any(not isinstance(key, str) or not key for key in ids)
            or len(set(ids)) != len(ids)
        ):
            raise ValueError("Invalid order")
    except (ValueError, UnicodeDecodeError, SuspiciousOperation):
        return error_result(400)
    removed = ReadingAssignment.all_objects.filter(book=book, deleted_at__isnull=False)
    if any(str(row.pk) in ids for row in removed):
        return error_result(404)
    rows = {str(row.pk): row for row in active_weeks(book)}
    if set(ids) != set(rows):
        return error_result(400)
    ordered = [rows[key] for key in ids]
    if (
        warnings([facts(row) for row in ordered], book.page_count)
        and not body["acknowledged"]
    ):
        return error_result(400)
    renumber(ordered)
    return 200, projection(book)


@transaction.atomic
@require_permission("manage_meetings")
def remove_week(request, book_id, week_id):
    refusal = locked_actor_refusal(request)
    if refusal:
        return error_result(refusal)
    book = lookup_book(book_id, lock=True)
    if not book:
        return error_result(404)
    rows = active_weeks(book)
    row = next((row for row in rows if str(row.pk) == week_id), None)
    if row is None:
        return error_result(404)
    row.soft_delete(request.user)
    renumber([week for week in rows if week.pk != row.pk])
    return 200, projection(book)


def schedule(book, actor):
    result = []
    for row in active_weeks(book):
        meeting = (
            row.meeting if row.meeting_id and row.meeting.deleted_at is None else None
        )
        result.append(
            {
                "id": str(row.pk),
                "weekNumber": row.week_number,
                "completedByMe": row.completions.filter(
                    member_id=actor.pk, completed_at__isnull=False
                ).exists(),
                "percentStart": row.percent_start,
                "percentEnd": row.percent_end,
                "pageStart": row.page_start,
                "pageEnd": row.page_end,
                "dueDate": row.due_date,
                "notes": row.notes,
                "meeting": {"id": str(meeting.pk), "startsAt": meeting.starts_at}
                if meeting
                else None,
            }
        )
    return result
