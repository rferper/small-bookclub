"""Equal-weight approval totals and manual ties."""

from votes.services import leaders


def test_highest_approval_count_wins_without_weighting_or_runoff():
    assert leaders([("a", 3), ("b", 1), ("c", 2)]) == ["a"]
    assert leaders([("a", 3), ("b", 1), ("c", 3)]) == ["a", "c"]


def test_zero_approvals_tie_every_candidate_in_shortlist_order():
    assert leaders([("c", 0), ("a", 0), ("b", 0)]) == ["c", "a", "b"]
    assert leaders([]) == []
