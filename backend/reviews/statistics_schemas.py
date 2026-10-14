"""Closed native statistics/compatibility wire shapes."""

from typing import Annotated, Literal

from pydantic import Field

from books.schemas import Mean
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
