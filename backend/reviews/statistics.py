"""Pure statistics over already viewer-permitted reviews and plain summaries.

Callers must apply the central spoiler policy before supplying any reviews.
No ORM or permission inference belongs here. Scores retain equal review weight.
"""

import unicodedata
from copy import deepcopy
from functools import cmp_to_key
from math import fsum, sqrt

from .math import club_averages, overall_score

BOOK_RATINGS_THRESHOLD = 3
MEMBER_RATINGS_THRESHOLD = 3
TIE_TOLERANCE = 1e-9


def _spanish_key(name):
    # Same modern Spanish primary order as the native member directory,
    # without importing its ORM dependencies or changing the process locale.
    folded = unicodedata.normalize("NFC", name.casefold())
    primary = []
    for character in folded:
        if character == "ñ":
            primary.append(ord("n") + 0.5)
        else:
            primary.extend(
                ord(part)
                for part in unicodedata.normalize("NFD", character)
                if not unicodedata.combining(part)
            )
    return tuple(primary)


def population_standard_deviation(values, mean):
    """Population spread, not sample spread; no observations have no spread."""
    values = list(values)
    if not values:
        return 0.0
    return sqrt(fsum((value - mean) ** 2 for value in values) / len(values))


def _extremes(entries, field, order, highest=True):
    extreme = (max if highest else min)(entry[field] for entry in entries)
    return sorted(
        (entry for entry in entries if abs(entry[field] - extreme) <= TIE_TOLERANCE),
        key=order,
    )


def _highest_and_lowest(entries, order):
    values = [entry["overallMean"] for entry in entries]
    if len(values) < 2 or max(values) - min(values) <= TIE_TOLERANCE:
        return [], []
    return (
        _extremes(entries, "overallMean", order),
        _extremes(entries, "overallMean", order, highest=False),
    )


def rating_statistics(*, reviews, books, members, viewer_id):
    """Return the contract's empty/available union using only counted inputs.

    Reviews contain bookId, memberId and scores. Unknown references are ignored.
    Summaries must be unique, safe BookSummary/MemberSummary dictionaries.
    """
    books = list(books)
    members = list(members)
    book_ids = {book["id"] for book in books}
    member_ids = {member["id"] for member in members}
    counted = [
        review
        for review in reviews
        if review["bookId"] in book_ids and review["memberId"] in member_ids
    ]
    all_means = club_averages(review["scores"] for review in counted)
    if all_means is None:
        return {"status": "empty"}

    book_entries = []
    for book in books:
        scores = [r["scores"] for r in counted if r["bookId"] == book["id"]]
        means = club_averages(scores)
        if means is not None:
            book_entries.append(
                {
                    "book": deepcopy(book),
                    "reviewCount": means["reviewCount"],
                    "overallMean": means["overallMean"],
                    "dispersion": population_standard_deviation(
                        (overall_score(score) for score in scores), means["overallMean"]
                    ),
                }
            )

    def by_title(entry):
        return _spanish_key(entry["book"]["title"])

    def compare_books(left, right):
        difference = right["overallMean"] - left["overallMean"]
        if abs(difference) > TIE_TOLERANCE:
            return 1 if difference > 0 else -1
        return (by_title(left) > by_title(right)) - (by_title(left) < by_title(right))

    book_entries.sort(key=cmp_to_key(compare_books))
    member_entries = []
    for member in members:
        means = club_averages(
            r["scores"] for r in counted if r["memberId"] == member["id"]
        )
        if means is not None:
            member_entries.append(
                {
                    "member": deepcopy(member),
                    "isMe": member["id"] == viewer_id,
                    "reviewCount": means["reviewCount"],
                    "overallMean": means["overallMean"],
                }
            )

    def by_name(entry):
        return _spanish_key(entry["member"]["displayName"])

    member_entries.sort(key=lambda entry: (not entry["isMe"], by_name(entry)))
    rated_books = [
        entry
        for entry in book_entries
        if entry["reviewCount"] >= BOOK_RATINGS_THRESHOLD
    ]
    rated_members = [
        entry
        for entry in member_entries
        if entry["reviewCount"] >= MEMBER_RATINGS_THRESHOLD
    ]
    top, lowest = _highest_and_lowest(rated_books, by_title)
    generous, harshest = _highest_and_lowest(rated_members, by_name)
    divisive = []
    if (
        len(rated_books) >= 2
        and max(entry["dispersion"] for entry in rated_books) > TIE_TOLERANCE
    ):
        divisive = _extremes(rated_books, "dispersion", by_title)
    return {
        "status": "available",
        "bookCount": len(book_entries),
        **all_means,
        "books": book_entries,
        "members": member_entries,
        "highlights": {
            "topRated": top,
            "lowestRated": lowest,
            "mostDivisive": divisive,
            "mostGenerous": generous,
            "harshest": harshest,
        },
    }


def activity_counts(*, books, meetings, now):
    """Count supplied retained books and noncancelled, strictly past meetings.

    Inputs are plain rows: book status, meeting dateTime/cancelled. The caller
    supplies only retained rows and an explicit timezone-aware clock.
    """
    if now.utcoffset() is None:
        raise ValueError("An aware current time is required")
    meetings = list(meetings)
    if any(meeting["dateTime"].utcoffset() is None for meeting in meetings):
        raise ValueError("Aware meeting dates are required")
    return {
        "booksRead": sum(
            book["status"] in {"terminado", "archivado"} for book in books
        ),
        "meetingsHeld": sum(
            not meeting["cancelled"] and meeting["dateTime"] < now
            for meeting in meetings
        ),
    }
