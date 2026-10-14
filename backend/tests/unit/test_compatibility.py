"""Fictional permitted pairs, exact differences and honest overlap thresholds."""

from copy import deepcopy

import pytest

from reviews.compatibility import taste_compatibility
from reviews.constants import CRITERIA

BOOKS = [
    {"id": str(i), "title": title, "authors": [], "coverUrl": None}
    for i, title in enumerate(["Zafiro", "Ángeles", "Nubes", "Ñandú", "Océano"])
]
MEMBERS = [
    {"id": str(i), "displayName": name, "avatarUrl": None}
    for i, name in enumerate(["Viewer", "Óscar", "Élida", "Ñora", "Nuria"])
]


def review(book, member, values):
    return {
        "bookId": book,
        "memberId": member,
        "scores": dict(zip(CRITERIA, values, strict=True))
        if isinstance(values, list)
        else dict.fromkeys(CRITERIA, values),
    }


def compare(rows):
    return taste_compatibility(
        reviews=rows, books=BOOKS, members=MEMBERS, viewer_id="0"
    )


@pytest.mark.parametrize("count", [0, 1, 2])
def test_insufficient_union_has_count_but_no_books_scores_or_differences(count):
    result = compare(
        [review(str(i), member, 4) for i in range(count) for member in ["0", "1"]]
    )
    entry = next(row for row in result["members"] if row["member"]["id"] == "1")
    assert entry["sharedBookCount"] == count
    assert entry["comparison"] == {"status": "insufficient"}
    assert result["minSharedBooks"] == 3


def test_absolute_overall_difference_is_not_mean_criterion_difference():
    mine = [5, 1, 3, 3, 3]
    theirs = [1, 5, 3, 3, 3]
    result = compare(
        [
            review(str(i), member, values)
            for i in range(3)
            for member, values in [("0", mine), ("1", theirs)]
        ]
    )
    entry = next(row for row in result["members"] if row["member"]["id"] == "1")
    assert entry["sharedBookCount"] == 3
    assert entry["comparison"]["overallDifference"] == 0
    assert entry["comparison"]["criterionDifferences"] == dict(
        zip(CRITERIA, [4, 4, 0, 0, 0], strict=True)
    )
    assert [b["book"]["title"] for b in entry["comparison"]["books"]] == [
        "Ángeles",
        "Nubes",
        "Zafiro",
    ]


def test_means_are_unrounded_on_shared_books_only_and_unknown_books_do_not_count():
    rows = [review(str(i), "0", 5) for i in range(5)]
    rows += [review(str(i), "1", value) for i, value in enumerate([5, 4, 1])]
    rows += [review("absent", member, 1) for member in ["0", "1"]]
    result = compare(rows)
    entry = next(row for row in result["members"] if row["member"]["id"] == "1")
    assert entry["sharedBookCount"] == 3
    assert entry["comparison"]["overallDifference"] == 5 / 3
    assert entry["comparison"]["criterionDifferences"] == dict.fromkeys(CRITERIA, 5 / 3)
    assert [e["member"]["displayName"] for e in result["members"]] == [
        "Élida",
        "Nuria",
        "Ñora",
        "Óscar",
    ]
    assert all(e["member"]["id"] != "0" for e in result["members"])
    assert all(e["sharedBookCount"] == 0 for e in result["members"][:-1])


@pytest.mark.parametrize("bad", [True, None, "3", 0, 3.25, float("nan")])
def test_available_pairs_validate_scores(bad):
    with pytest.raises(ValueError):
        compare(
            [
                review(str(i), member, bad if member == "1" else 4)
                for i in range(3)
                for member in ["0", "1"]
            ]
        )


def test_input_order_and_nested_values_are_unchanged():
    rows = [review(str(i), member, 4) for i in range(3) for member in ["0", "1"]]
    before = deepcopy((rows, BOOKS, MEMBERS))
    result = compare(rows)
    result["members"][-1]["comparison"]["books"][0]["book"]["authors"].append(
        "Fictional author"
    )
    result["members"][0]["member"]["displayName"] = "Changed"
    assert (rows, BOOKS, MEMBERS) == before
