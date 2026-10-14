"""Pure mean absolute differences on already viewer-permitted shared books."""

from copy import deepcopy
from decimal import Decimal

from .constants import CRITERIA
from .math import validated_scores
from .statistics import _spanish_key

MIN_SHARED_BOOKS = 3


def taste_compatibility(*, reviews, books, members, viewer_id):
    """Compare the viewer with each supplied member, never rank their tastes."""
    rows = {(r["memberId"], r["bookId"]): r["scores"] for r in reviews}
    ordered_books = sorted(books, key=lambda book: _spanish_key(book["title"]))
    result = []
    for member in sorted(members, key=lambda m: _spanish_key(m["displayName"])):
        if member["id"] == viewer_id:
            continue
        shared = [
            book
            for book in ordered_books
            if (viewer_id, book["id"]) in rows and (member["id"], book["id"]) in rows
        ]
        entry = {
            "member": deepcopy(member),
            "sharedBookCount": len(shared),
            "comparison": {"status": "insufficient"},
        }
        if len(shared) >= MIN_SHARED_BOOKS:
            differences = {criterion: Decimal(0) for criterion in CRITERIA}
            overall_total = Decimal(0)
            shared_books = []
            for book in shared:
                mine = validated_scores(rows[viewer_id, book["id"]])
                theirs = validated_scores(rows[member["id"], book["id"]])
                my_overall = sum(mine.values(), Decimal(0)) / 5
                their_overall = sum(theirs.values(), Decimal(0)) / 5
                difference = abs(my_overall - their_overall)
                overall_total += difference
                for criterion in CRITERIA:
                    differences[criterion] += abs(mine[criterion] - theirs[criterion])
                shared_books.append(
                    {
                        "book": deepcopy(book),
                        "myOverall": float(my_overall),
                        "theirOverall": float(their_overall),
                        "difference": float(difference),
                    }
                )
            entry["comparison"] = {
                "status": "available",
                "overallDifference": float(overall_total / len(shared)),
                "criterionDifferences": {
                    criterion: float(value / len(shared))
                    for criterion, value in differences.items()
                },
                "books": shared_books,
            }
        result.append(entry)
    return {"minSharedBooks": MIN_SHARED_BOOKS, "members": result}
