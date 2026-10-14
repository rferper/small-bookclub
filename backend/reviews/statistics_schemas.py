"""Closed native statistics/compatibility wire shapes."""

from typing import Annotated, Literal

from pydantic import Field

from books.schemas import CriterionMeans, Mean
from users.schemas import BookSummary, ClosedSchema, MemberSummary

Difference = Annotated[float, Field(ge=0, le=4)]


class CriterionDifferences(ClosedSchema):
    disfrute: Difference
    estilo: Difference
    personajes: Difference
    trama: Difference
    huella: Difference


class SharedBook(ClosedSchema):
    book: BookSummary
    myOverall: Mean
    theirOverall: Mean
    difference: Difference


class TasteComparisonInsufficient(ClosedSchema):
    status: Literal["insufficient"] = Field(
        json_schema_extra=lambda schema: schema.pop("type", None)
    )


class TasteComparisonAvailable(ClosedSchema):
    status: Literal["available"] = Field(
        json_schema_extra=lambda schema: schema.pop("type", None)
    )
    overallDifference: Difference
    criterionDifferences: CriterionDifferences
    books: list[SharedBook] = Field(min_length=3)


class MemberCompatibility(ClosedSchema):
    member: MemberSummary
    sharedBookCount: int = Field(ge=0)
    comparison: Annotated[
        TasteComparisonInsufficient | TasteComparisonAvailable,
        Field(discriminator="status"),
    ]


class TasteCompatibility(ClosedSchema):
    minSharedBooks: int = Field(ge=1)
    members: list[MemberCompatibility]


class StatisticsThresholds(ClosedSchema):
    bookRatings: int = Field(ge=1)
    memberRatings: int = Field(ge=1)


class BookStatistics(ClosedSchema):
    book: BookSummary
    reviewCount: int = Field(ge=1)
    overallMean: Mean
    dispersion: float = Field(ge=0, le=2)


class MemberStatistics(ClosedSchema):
    member: MemberSummary
    isMe: bool
    reviewCount: int = Field(ge=1)
    overallMean: Mean


class StatisticsHighlights(ClosedSchema):
    topRated: list[BookStatistics]
    lowestRated: list[BookStatistics]
    mostDivisive: list[BookStatistics]
    mostGenerous: list[MemberStatistics]
    harshest: list[MemberStatistics]


class RatingStatisticsEmpty(ClosedSchema):
    status: Literal["empty"] = Field(
        json_schema_extra=lambda schema: schema.pop("type", None)
    )


class RatingStatisticsAvailable(ClosedSchema):
    status: Literal["available"] = Field(
        json_schema_extra=lambda schema: schema.pop("type", None)
    )
    bookCount: int = Field(ge=1)
    reviewCount: int = Field(ge=1)
    overallMean: Mean
    criterionMeans: CriterionMeans
    books: list[BookStatistics] = Field(min_length=1)
    members: list[MemberStatistics] = Field(min_length=1)
    highlights: StatisticsHighlights


class Statistics(ClosedSchema):
    booksRead: int = Field(ge=0)
    meetingsHeld: int = Field(ge=0)
    thresholds: StatisticsThresholds
    ratings: Annotated[
        RatingStatisticsEmpty | RatingStatisticsAvailable, Field(discriminator="status")
    ]
