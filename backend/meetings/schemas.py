"""Independent closed calendar and safe removal wire schemas."""

from datetime import datetime
from typing import Annotated, Literal, NotRequired, TypedDict

from pydantic import ConfigDict, Field, with_config

from books.home_schemas import NextMeeting
from users.schemas import ClosedSchema, MemberSummary

Id = Annotated[str, Field(min_length=1)]
SafeOrdinal = Annotated[int, Field(ge=1, le=9007199254740991)]


class MeetingListItem(NextMeeting):
    cancelled: bool


class MeetingList(ClosedSchema):
    upcoming: list[MeetingListItem]
    past: list[MeetingListItem]


@with_config(ConfigDict(extra="forbid"))
class AdminMeeting(TypedDict):
    id: Id
    startsAt: datetime
    bookId: Id | None
    weekId: Id | None
    cancelled: bool
    upcoming: bool
    attendance: list[MemberSummary] | None
    attendanceEligible: bool
    removedWeekNumber: NotRequired[SafeOrdinal]


class MeetingBookChoice(ClosedSchema):
    id: Id
    title: str


class MeetingWeekChoice(ClosedSchema):
    id: Id
    bookId: Id
    weekNumber: SafeOrdinal
    meetingId: Id | None


class AdminMeetingCalendar(ClosedSchema):
    clubTimezone: str = Field(min_length=1)
    upcoming: list[AdminMeeting]
    past: list[AdminMeeting]
    books: list[MeetingBookChoice]
    weeks: list[MeetingWeekChoice]
    activeMembers: list[MemberSummary]


class MeetingInput(ClosedSchema):
    startsAt: datetime
    bookId: Id | None
    weekId: Id | None


class CancelledInput(ClosedSchema):
    cancelled: bool


class DeletionPreview(ClosedSchema):
    label: str
    dependencies: list[str]


class BinMetadata(ClosedSchema):
    id: Id
    label: str
    deletedAt: datetime
    deletedByName: str
    purgeDueAt: datetime
    expired: bool
    dependencies: list[str]


class BinBook(BinMetadata):
    type: Literal["book"]


class BinMeeting(BinMetadata):
    type: Literal["meeting"]


class BinQuote(BinMetadata):
    type: Literal["quote"]


class BinWeek(BinMetadata):
    type: Literal["week"]


class BinHighlight(BinMetadata):
    type: Literal["highlight"]


def exclusive_variants(schema):
    # Closed disjoint literal types match the contract's exclusive union.
    schema["oneOf"] = schema.pop("anyOf")


RecycleBinEntry = Annotated[
    BinBook | BinMeeting | BinQuote | BinWeek | BinHighlight,
    Field(json_schema_extra=exclusive_variants),
]
