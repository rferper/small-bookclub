"""Closed existing quote contract; writes are normalized in the service."""

from typing import Annotated

from pydantic import Field

from users.schemas import ClosedSchema

QuoteText = Annotated[
    str,
    Field(
        min_length=1,
        max_length=1000,
        pattern=r"\S",
        json_schema_extra={"x-trimmedMinLength": 1, "x-trimmedMaxLength": 1000},
    ),
]
AttributionText = Annotated[
    str, Field(max_length=200, json_schema_extra={"x-trimmedMaxLength": 200})
]


class LiteraryQuoteInput(ClosedSchema):
    text: QuoteText
    author: AttributionText | None
    source: AttributionText | None
    active: bool


class AdminLiteraryQuote(LiteraryQuoteInput):
    id: str = Field(min_length=1)
