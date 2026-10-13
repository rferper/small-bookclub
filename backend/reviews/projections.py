"""Closed own-review projection; foreign ratings remain gated separately."""

from users.access import can_view_reviews
from users.directory import member_summary

from .constants import CRITERIA
from .math import club_averages


def own_review(row):
    if row is None:
        return None
    return {
        "scores": {criterion: float(row.scores[criterion]) for criterion in CRITERIA},
        "overall": row.overall,
        "text": row.text,
        "submittedAt": row.submitted_at,
        "editedAt": row.edited_at,
    }


def club_reviews(book, actor, *, finished, own):
    """Do not load foreign rows at all until the central gate permits them."""
    if not can_view_reviews(
        actor, personally_finished=finished, own_review_submitted=own is not None
    ):
        return {"status": "locked"}
    rows = list(book.reviews.select_related("member").order_by("submitted_at", "pk"))
    return {
        "status": "visible",
        **club_averages([row.scores for row in rows]),
        "reviews": [
            {
                "member": member_summary(row.member),
                "scores": {
                    criterion: float(row.scores[criterion]) for criterion in CRITERIA
                },
                "overall": row.overall,
                "text": row.text,
                "isMine": row.member_id == actor.pk,
            }
            for row in rows
        ],
    }
