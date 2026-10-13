"""Contract ratings envelope used by the personal completion read/write routes."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field

from users.schemas import BookSummary, ClosedSchema, MemberSummary

Mean = Annotated[float, Field(ge=1, le=5)]
Score = Annotated[float, Field(ge=1, le=5, multiple_of=0.5)]


class CriterionScores(ClosedSchema):
    disfrute: Score
    estilo: Score
    personajes: Score
    trama: Score
    huella: Score


class CriterionMeans(ClosedSchema):
    disfrute: Mean
    estilo: Mean
    personajes: Mean
    trama: Mean
    huella: Mean


class MyReview(ClosedSchema):
    scores: CriterionScores
    overall: Mean
    text: str | None
    submittedAt: datetime
    editedAt: datetime | None


class ClubReview(ClosedSchema):
    member: MemberSummary
    scores: CriterionScores
    overall: Mean
    text: str | None
    isMine: bool


class ClubRatingsLocked(ClosedSchema):
    status: Literal["locked"] = Field(
        json_schema_extra=lambda schema: schema.pop("type", None)
    )


class ClubRatingsVisible(ClosedSchema):
    status: Literal["visible"] = Field(
        json_schema_extra=lambda schema: schema.pop("type", None)
    )
    reviewCount: int = Field(ge=1)
    overallMean: Mean
    criterionMeans: CriterionMeans
    reviews: list[ClubReview] = Field(min_length=1)


class BookRatings(ClosedSchema):
    book: BookSummary
    ratable: bool
    finishedByMe: bool
    myReview: MyReview | None
    club: Annotated[
        ClubRatingsLocked | ClubRatingsVisible, Field(discriminator="status")
    ]


class FinishedInput(ClosedSchema):
    finished: bool
