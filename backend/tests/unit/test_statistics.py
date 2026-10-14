"""Fictional, already-permitted inputs: exact means and cautious highlights."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from math import sqrt

import pytest

from reviews.constants import CRITERIA
from reviews.statistics import (
    activity_counts,
    population_standard_deviation,
    rating_statistics,
)

BOOKS = [
    {"id": key, "title": title, "authors": ["Autora ficticia"], "coverUrl": None}
    for key, title in [("b1", "Ángeles"), ("b2", "Barro"), ("b3", "Cartas")]
]
MEMBERS = [
    {"id": key, "displayName": name, "avatarUrl": None}
    for key, name in [("m1", "Ana"), ("m2", "Bruno"), ("m3", "Élida")]
]


def review(book, member, values):
    return {
        "bookId": book,
        "memberId": member,
        "scores": dict(zip(CRITERIA, values, strict=True))
        if isinstance(values, list)
        else dict.fromkeys(CRITERIA, values),
    }


def stats(reviews, **kwargs):
    return rating_statistics(
        reviews=reviews, books=BOOKS, members=MEMBERS, viewer_id="m3", **kwargs
    )


def book_ids(entries):
    return [entry["book"]["id"] for entry in entries]


def member_ids(entries):
    return [entry["member"]["id"] for entry in entries]


def three_each(values):
    return [
        review(book, member["id"], score)
        for book, score in values.items()
        for member in MEMBERS
    ]


def test_exact_means_equal_review_weight_and_population_dispersion():
    result = stats(
        [
            review("b1", "m1", [5, 4, 4, 3, 4]),
            review("b1", "m2", 2),
            review("b2", "m1", 5),
        ]
    )
    assert result["bookCount"] == 2
    assert result["reviewCount"] == 3
    assert result["overallMean"] == pytest.approx(11 / 3)
    assert result["criterionMeans"] == dict(
        zip(CRITERIA, [4, 11 / 3, 11 / 3, 10 / 3, 11 / 3], strict=True)
    )
    assert result["books"][0]["overallMean"] == 5
    assert result["books"][0]["dispersion"] == 0
    assert result["books"][1]["overallMean"] == 3
    assert result["books"][1]["dispersion"] == 1
    assert result["members"][0]["overallMean"] == 4.5
    assert result["members"][0]["reviewCount"] == 2
    assert population_standard_deviation([2, 4, 4, 4, 5, 5, 7, 9], 5) == 2
    assert population_standard_deviation([], 0) == 0


def test_five_criterion_example_is_not_rounded():
    result = stats(
        [
            review("b1", "m1", [5, 4.5, 3, 4, 2.5]),
            review("b1", "m2", [4, 5, 4.5, 3.5, 5]),
            review("b1", "m3", [3, 3.5, 5, 4, 4.5]),
        ]
    )
    assert result["overallMean"] == pytest.approx(12.2 / 3)
    assert result["books"][0]["dispersion"] == pytest.approx(
        sqrt(sum((v - 12.2 / 3) ** 2 for v in [3.8, 4.4, 4]) / 3)
    )


def test_unknown_references_do_not_affect_denominators_or_validate_hidden_scores():
    rows = [review("absent", "m1", "bad"), review("b1", "absent", "bad")]
    assert stats(rows) == {"status": "empty"}
    assert stats([]) == {"status": "empty"}
    result = stats([*rows, review("b1", "m1", 4)])
    assert result["reviewCount"] == result["bookCount"] == 1
    assert result["overallMean"] == 4


@pytest.mark.parametrize(
    "bad", [True, None, "4", 0, 5.5, 3.25, float("nan"), float("inf")]
)
def test_counted_invalid_scores_are_rejected(bad):
    with pytest.raises(ValueError):
        stats([review("b1", "m1", bad)])


def test_missing_scores_are_rejected():
    row = review("b1", "m1", 3)
    del row["scores"]["huella"]
    with pytest.raises(ValueError):
        stats([row])


def test_order_is_mean_then_spanish_title_and_viewer_then_spanish_name():
    result = stats(
        [
            review("b2", "m1", 4),
            review("b1", "m2", 4),
            review("b3", "m3", 1),
        ]
    )
    assert book_ids(result["books"]) == ["b1", "b2", "b3"]
    assert member_ids(result["members"]) == ["m3", "m1", "m2"]
    assert [entry["isMe"] for entry in result["members"]] == [True, False, False]


def test_spanish_enye_sorts_after_n_and_before_o():
    members = [
        {"id": str(i), "displayName": name, "avatarUrl": None}
        for i, name in enumerate(["Óscar", "Ñora", "Nuria", "Élida"])
    ]
    result = rating_statistics(
        reviews=[review("b1", m["id"], 3) for m in members],
        books=BOOKS,
        members=members,
        viewer_id="absent",
    )
    assert [entry["member"]["displayName"] for entry in result["members"]] == [
        "Élida",
        "Nuria",
        "Ñora",
        "Óscar",
    ]


def test_book_highlights_need_three_ratings_and_two_qualifying_books():
    rows = three_each({"b1": 4}) + [review("b2", "m1", 5), review("b2", "m2", 4.5)]
    initial = stats(rows)["highlights"]
    assert (
        initial["topRated"] == initial["lowestRated"] == initial["mostDivisive"] == []
    )
    result = stats([*rows, review("b2", "m3", 5)])["highlights"]
    assert book_ids(result["topRated"]) == ["b2"]
    assert book_ids(result["lowestRated"]) == ["b1"]
    assert book_ids(result["mostDivisive"]) == ["b2"]


def test_all_tied_extremes_are_kept_and_equal_means_have_no_best_or_worst():
    result = stats(three_each({"b3": 4, "b1": 4, "b2": 2}))["highlights"]
    assert book_ids(result["topRated"]) == ["b1", "b3"]
    assert book_ids(result["lowestRated"]) == ["b2"]
    assert result["mostDivisive"] == []
    equal = stats(
        [
            *three_each({"b1": 3}),
            review("b2", "m1", 2),
            review("b2", "m2", 3),
            review("b2", "m3", 4),
        ]
    )["highlights"]
    assert equal["topRated"] == equal["lowestRated"] == []
    assert book_ids(equal["mostDivisive"]) == ["b2"]


def test_divisive_ties_survive_float_noise():
    values = [[5, 4.5, 3, 4, 2.5], [4, 5, 4.5, 3.5, 5], [3, 3.5, 5, 4, 4.5]]
    result = stats(
        [
            *[
                review("b1", member["id"], score)
                for member, score in zip(MEMBERS, values, strict=True)
            ],
            *[
                review("b2", member["id"], [v - 1 for v in score])
                for member, score in zip(MEMBERS, values, strict=True)
            ],
        ]
    )
    assert book_ids(result["highlights"]["mostDivisive"]) == ["b1", "b2"]


def test_member_highlights_use_review_threshold_and_keep_all_ties():
    rows = [
        review(book["id"], member, value)
        for member, value in [("m1", 2), ("m2", 5)]
        for book in BOOKS
    ]
    rows += [review("b1", "m3", 5), review("b2", "m3", 5)]
    assert member_ids(stats(rows)["highlights"]["mostGenerous"]) == ["m2"]
    rows.append(review("b3", "m3", 5))
    result = stats(rows)["highlights"]
    assert member_ids(result["mostGenerous"]) == ["m2", "m3"]
    assert member_ids(result["harshest"]) == ["m1"]
    assert (
        stats(three_each({"b1": 3, "b2": 3, "b3": 3}))["highlights"]["harshest"] == []
    )
    assert (
        stats([review(book["id"], "m1", 4) for book in BOOKS])["highlights"][
            "mostGenerous"
        ]
        == []
    )


def test_inputs_are_unchanged_and_output_summaries_are_independent():
    rows = three_each({"b1": 4, "b2": 2})
    before = deepcopy((rows, BOOKS, MEMBERS))
    result = stats(rows)
    result["books"][0]["book"]["authors"].append("Another fictional author")
    result["members"][0]["member"]["displayName"] = "Changed"
    assert (rows, BOOKS, MEMBERS) == before


def test_activity_counts_use_retained_status_and_strict_past_boundary():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    books = [
        {"status": status}
        for status in ["terminado", "archivado", "leyendo", "pendiente", "propuesto"]
    ]
    meetings = [
        {"dateTime": now + timedelta(seconds=offset), "cancelled": cancelled}
        for offset in [-1, 0, 1]
        for cancelled in [False, True]
    ]
    meetings.append(
        {"dateTime": now.astimezone(timezone(timedelta(hours=1))), "cancelled": False}
    )
    assert activity_counts(books=books, meetings=meetings, now=now) == {
        "booksRead": 2,
        "meetingsHeld": 1,
    }
    assert activity_counts(books=[], meetings=[], now=now) == {
        "booksRead": 0,
        "meetingsHeld": 0,
    }
    with pytest.raises(ValueError):
        activity_counts(books=[], meetings=[], now=now.replace(tzinfo=None))
    with pytest.raises(ValueError):
        activity_counts(
            books=[],
            meetings=[{"dateTime": now.replace(tzinfo=None), "cancelled": False}],
            now=now,
        )
