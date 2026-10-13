"""Independent closed admin record contract, including trimmed text annotations."""

from datetime import datetime
from typing import Literal

from pydantic import Field

from users.schemas import BookSummary, ClosedSchema, MemberSummary

from .schemas import Id, SafeOrdinal


class MeetingSummaryInput(ClosedSchema):
    text: str = Field(max_length=10000, json_schema_extra={"x-trimmedMaxLength": 10000})
    published: bool

    model_config = {
        "extra": "forbid",
        "json_schema_extra": {
            "allOf": [
                {
                    "if": {"properties": {"published": {"const": True}}},
                    "then": {
                        "properties": {"text": {"minLength": 1, "pattern": r"\S"}}
                    },
                }
            ]
        },
    }


class MeetingHighlightInput(ClosedSchema):
    text: str = Field(
        min_length=1,
        max_length=2000,
        pattern=r"\S",
        json_schema_extra={"x-trimmedMinLength": 1, "x-trimmedMaxLength": 2000},
    )
    published: bool
    kind: Literal["quote", "paraphrase"]
    speakerIds: list[Id] = Field(json_schema_extra={"uniqueItems": True})


class AdminMeetingHighlight(MeetingHighlightInput):
    id: Id
    speakers: list[MemberSummary]


class RecordWeek(ClosedSchema):
    id: Id
    weekNumber: SafeOrdinal
    removed: bool


class AdminMeetingRecord(ClosedSchema):
    id: Id
    startsAt: datetime
    cancelled: bool
    book: BookSummary | None
    week: RecordWeek | None
    markedSafe: bool
    summary: MeetingSummaryInput | None
    highlights: list[AdminMeetingHighlight]
    speakerOptions: list[MemberSummary]


class IdOrder(ClosedSchema):
    ids: list[Id] = Field(json_schema_extra={"uniqueItems": True})


class SafeInput(ClosedSchema):
    safe: bool
