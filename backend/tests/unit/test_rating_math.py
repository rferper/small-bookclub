"""Mandatory half-star scores and equal member weighting, without a database."""

from decimal import Decimal

import pytest

from reviews.constants import CRITERIA
from reviews.math import club_averages, overall_score, validated_scores


def scores(value=3):
    return dict.fromkeys(CRITERIA, value)


def test_overall_is_exact_mean_of_five_required_scores():
    values = dict(zip(CRITERIA, [5, 4.5, 3, 4, 2.5], strict=True))
    assert overall_score(values) == 3.8
    assert overall_score(scores(Decimal("4.5"))) == 4.5


def test_club_mean_weights_each_submitted_member_equally_and_updates_after_edit():
    assert club_averages([]) is None
    values = [scores(5), scores(1), scores(3)]
    result = club_averages(values)
    assert result == {
        "reviewCount": 3,
        "overallMean": 3.0,
        "criterionMeans": scores(3.0),
    }
    values[1] = scores(4)
    assert club_averages(values)["overallMean"] == 4.0


@pytest.mark.parametrize(
    "bad",
    [
        None,
        True,
        "3",
        0,
        5.5,
        3.25,
        float("nan"),
        float("inf"),
        Decimal("NaN"),
        Decimal("4.0000000000000000000000000001"),
    ],
)
def test_invalid_values_are_rejected(bad):
    value = scores()
    value["huella"] = bad
    with pytest.raises(ValueError):
        validated_scores(value)


@pytest.mark.parametrize("value", [{}, {"disfrute": 3}, {**scores(), "other": 3}, []])
def test_missing_or_extra_criteria_are_rejected(value):
    with pytest.raises(ValueError):
        overall_score(value)
