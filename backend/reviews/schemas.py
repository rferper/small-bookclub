"""Closed rubric schemas matching the existing numeric-key contract."""

from typing import Annotated

from pydantic import Field, create_model

from books.schemas import CriterionScores, MyReview
from users.schemas import BookSummary, ClosedSchema

from .models import CRITERIA

RubricAnchors = create_model(
    "RubricAnchors",
    __base__=ClosedSchema,
    **{str(star): (str | None, ...) for star in range(1, 6)},
)
RatingRubric = create_model(
    "RatingRubric",
    __base__=ClosedSchema,
    **{criterion: (RubricAnchors, ...) for criterion in CRITERIA},
)
AnchorText = Annotated[
    str, Field(max_length=500, json_schema_extra={"x-trimmedMaxLength": 500})
]
RubricInputAnchors = create_model(
    "RubricInputAnchors",
    __base__=ClosedSchema,
    **{str(star): (AnchorText | None, ...) for star in range(1, 6)},
)
RatingRubricInput = create_model(
    "RatingRubricInput",
    __base__=ClosedSchema,
    **{criterion: (RubricInputAnchors, ...) for criterion in CRITERIA},
)


ReviewText = Annotated[str, Field(json_schema_extra={"x-trimmedMaxLength": 5000})]


class ReviewInput(ClosedSchema):
    scores: CriterionScores
    text: ReviewText | None = Field(
        default=None, json_schema_extra=lambda schema: schema.pop("default", None)
    )


class MyReviewEntry(MyReview):
    book: BookSummary
