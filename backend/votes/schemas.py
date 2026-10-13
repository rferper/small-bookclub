"""Closed wire schemas for votes, mirroring openapi.yaml."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field

from users.schemas import BookSummary, ClosedSchema, MemberSummary

Id = Annotated[str, Field(min_length=1)]


class VoteCandidateBook(ClosedSchema):
    id: Id
    title: str
    authors: list[str]
    coverUrl: str | None
    publicationDate: str | None
    pageCount: int | None = Field(ge=1)


class VoteCandidate(ClosedSchema):
    book: VoteCandidateBook
    approvals: list[MemberSummary]
    approvedByMe: bool


class VoteOutcomeWinner(ClosedSchema):
    status: Literal["winner"] = Field(
        json_schema_extra=lambda schema: schema.pop("type", None)
    )
    winner: BookSummary
    tieNote: str | None


class VoteOutcomeTiePending(ClosedSchema):
    status: Literal["tiePending"] = Field(
        json_schema_extra=lambda schema: schema.pop("type", None)
    )
    tiedBookIds: list[Id] = Field(
        min_length=2, json_schema_extra={"uniqueItems": True}
    )


class Vote(ClosedSchema):
    id: Id
    status: Literal["draft", "open", "closed"]
    curator: MemberSummary
    openedAt: datetime | None
    closedAt: datetime | None
    candidates: list[VoteCandidate]
    outcome: (
        Annotated[VoteOutcomeWinner | VoteOutcomeTiePending, Field(discriminator="status")]
        | None
    )
    canManage: bool
    canRecordTieWinner: bool
    curatedByMe: bool


class VoteHistoryItem(ClosedSchema):
    id: Id
    curator: MemberSummary
    openedAt: datetime
    closedAt: datetime
    outcome: Annotated[
        VoteOutcomeWinner | VoteOutcomeTiePending, Field(discriminator="status")
    ]
    candidateCount: int = Field(ge=0)


class VotesOverview(ClosedSchema):
    curator: MemberSummary | None
    current: Vote | None
    history: list[VoteHistoryItem]
    canCreateVote: bool


class CandidateInput(ClosedSchema):
    bookId: Id


class CandidateOrderInput(ClosedSchema):
    bookIds: list[Id] = Field(json_schema_extra={"uniqueItems": True})
