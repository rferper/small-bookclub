"""Closed own-review projection; foreign ratings remain gated separately."""

from .constants import CRITERIA


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
