"""Closed independent reading-plan schemas."""

from datetime import date, datetime
from typing import Annotated, NotRequired, TypedDict

from pydantic import ConfigDict, Field, with_config

from config.contract import resolve
from users.schemas import ClosedSchema

from .schemas import Id, SafeOrdinal

Percent = Annotated[float, Field(ge=0)]
Notes = Annotated[
    str, Field(max_length=1000, json_schema_extra={"x-trimmedMaxLength": 1000})
]


class ReadingWeekInput(ClosedSchema):
    percentStart: Percent
    percentEnd: Percent
    pageStart: SafeOrdinal
    pageEnd: SafeOrdinal
    dueDate: date | None
    notes: Notes | None
    meetingId: Id | None


class ReadingWeekWrite(ClosedSchema):
    input: ReadingWeekInput
    acknowledged: bool


class ReadingWeekOrder(ClosedSchema):
    ids: list[Id] = Field(json_schema_extra={"uniqueItems": True})
    acknowledged: bool


@with_config(ConfigDict(extra="forbid"))
class AdminReadingWeek(TypedDict):
    percentStart: Percent
    percentEnd: Percent
    pageStart: SafeOrdinal
    pageEnd: SafeOrdinal
    dueDate: date | None
    notes: Notes | None
    meetingId: Id | None
    id: Id
    weekNumber: SafeOrdinal
    completionCount: Annotated[int, Field(ge=0)]
    removedMeeting: NotRequired[bool]


class PlanBook(ClosedSchema):
    id: Id
    title: str
    pageCount: SafeOrdinal | None


class PlanMeeting(ClosedSchema):
    id: Id
    startsAt: datetime
    cancelled: bool


class AdminReadingPlan(ClosedSchema):
    book: PlanBook
    weeks: list[AdminReadingWeek]
    meetings: list[PlanMeeting]


def write_schema():
    schema = ReadingWeekWrite.model_json_schema()
    expanded = resolve(schema, schema)
    expanded.pop("$defs", None)
    return expanded
