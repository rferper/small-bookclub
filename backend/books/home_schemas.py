"""Closed existing homepage envelope, including staged future sections."""

from datetime import datetime
from typing import Literal

from pydantic import Field

from users.schemas import BookSummary, ClosedSchema, MemberSummary


class ReadingWeek(ClosedSchema):
    id: str = Field(min_length=1)
    weekNumber: int = Field(ge=1)
    percentStart: float = Field(ge=0)
    percentEnd: float = Field(ge=0)
    pageStart: int = Field(ge=1, le=9007199254740991)
    pageEnd: int = Field(ge=1, le=9007199254740991)
    meetingStartsAt: datetime | None
    completedByMe: bool


class MeetingAssignment(ClosedSchema):
    weekNumber: int = Field(ge=1)
    percentStart: float = Field(ge=0)
    percentEnd: float = Field(ge=0)
    pageStart: int = Field(ge=1, le=9007199254740991)
    pageEnd: int = Field(ge=1, le=9007199254740991)


class NextMeeting(ClosedSchema):
    id: str = Field(min_length=1)
    startsAt: datetime
    book: BookSummary | None
    assignment: MeetingAssignment | None


class MemberProgress(ClosedSchema):
    member: MemberSummary
    completed: bool


class ActivityEvent(ClosedSchema):
    id: str = Field(min_length=1)
    type: Literal[
        "book_selected",
        "vote_opened",
        "vote_closed",
        "nomination_added",
        "summary_published",
        "review_available",
    ]
    occurredAt: datetime
    text: str


class ClubStats(ClosedSchema):
    booksCompleted: int = Field(ge=0)
    reviews: int = Field(ge=0)
    members: int = Field(ge=0)


class LiteraryQuote(ClosedSchema):
    text: str
    author: str | None
    source: str | None


class HomeData(ClosedSchema):
    currentBook: BookSummary | None
    currentWeek: ReadingWeek | None
    nextMeeting: NextMeeting | None
    memberProgress: list[MemberProgress]
    recentActivity: list[ActivityEvent]
    stats: ClubStats
    quote: LiteraryQuote | None
