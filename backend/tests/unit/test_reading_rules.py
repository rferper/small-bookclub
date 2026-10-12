"""Exact manual reading validation and whole-plan warning boundaries."""

import pytest

from meetings.reading_rules import clean_input, warnings


def portion(**changes):
    return {
        "percentStart": 0,
        "percentEnd": 25,
        "pageStart": 1,
        "pageEnd": 25,
        "dueDate": None,
        "notes": None,
        "meetingId": None,
        **changes,
    }


@pytest.mark.parametrize(
    "changes",
    [
        {"percentStart": True},
        {"percentEnd": "2"},
        {"percentEnd": float("inf")},
        {"percentStart": float("nan")},
        {"percentEnd": -1},
        {"pageStart": 0},
        {"pageEnd": 2.5},
        {"pageEnd": True},
        {"pageEnd": 9007199254740992},
        {"dueDate": "2026-02-30"},
        {"dueDate": "0000-01-01"},
        {"dueDate": "2026-1-01"},
        {"dueDate": 1},
        {"notes": "x" * 1001},
        {"notes": False},
        {"meetingId": ""},
        {"meetingId": 1},
        {"extra": 1},
    ],
)
def test_malformed_facts_are_rejected(changes):
    with pytest.raises(ValueError):
        clean_input(portion(**changes))


def test_manual_decimals_over_100_trimmed_notes_and_dates_are_preserved():
    clean = clean_input(
        portion(
            percentStart=101.25,
            percentEnd=105,
            pageEnd=9007199254740991,
            notes="  manual  ",
            dueDate="2024-02-29",
        )
    )
    assert clean["percentStart"] == 101.25 and clean["pageEnd"] == 9007199254740991
    assert clean["notes"] == "manual" and clean["dueDate"] == "2024-02-29"
    assert clean_input(portion(notes=" \n "))["notes"] is None


@pytest.mark.parametrize(
    "changes,code",
    [
        ({"percentStart": 30}, "reversed_percent"),
        ({"pageStart": 26}, "reversed_pages"),
        ({"percentEnd": 101}, "percent_over_100"),
        ({"pageEnd": 101}, "pages_over_total"),
        ({"percentEnd": 35.01}, "discrepancy"),
    ],
)
def test_range_warning_codes(changes, code):
    assert (1, code) in warnings([portion(**changes)], 100)


def test_exact_ten_point_discrepancy_percent_touch_and_date_order_have_no_warning():
    rows = [
        portion(percentStart=11, percentEnd=35),
        portion(
            percentStart=35,
            percentEnd=60,
            pageStart=36,
            pageEnd=60,
            dueDate="2020-01-01",
        ),
    ]
    assert warnings(rows, 100) == []
    assert (1, "discrepancy") in warnings([portion(percentStart=11.001)], 100)


def test_inclusive_pages_overlap_normalized_ranges_and_backwards_starts():
    rows = [
        portion(),
        portion(percentStart=25, percentEnd=50, pageStart=25, pageEnd=50),
    ]
    assert warnings(rows, None) == [(2, "page_overlap")]
    codes = warnings(
        [
            portion(percentStart=40, percentEnd=20),
            portion(percentStart=10, percentEnd=30, pageStart=1, pageEnd=25),
        ],
        None,
    )
    assert (2, "backwards") in codes and (2, "percent_overlap") in codes


def test_unknown_page_count_and_gaps_add_no_warning():
    assert (
        warnings(
            [
                portion(),
                portion(percentStart=30, percentEnd=40, pageStart=90, pageEnd=100),
            ],
            None,
        )
        == []
    )
