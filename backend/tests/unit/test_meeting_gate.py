"""Central pure meeting access: exact trusted booleans and no admin override."""

from types import SimpleNamespace

import pytest

from users.access import can_view_meeting_record


@pytest.mark.parametrize("role", ["admin", "member"])
@pytest.mark.parametrize(
    "linked,done,safe,expected",
    [
        (True, False, False, False),
        (True, False, True, False),
        (True, True, False, True),
        (False, False, False, False),
        (False, False, True, True),
        (None, False, True, False),
        (True, 1, False, False),
        (False, False, 1, False),
    ],
)
def test_gate_requires_exact_current_week_or_explicit_safe_unlinked(
    role, linked, done, safe, expected
):
    actor = SimpleNamespace(
        pk=1,
        role=role,
        approved=True,
        revoked_at=None,
        is_authenticated=True,
        _state=SimpleNamespace(adding=False),
    )
    flags = dict(
        cancelled=False,
        linked_week=linked,
        week_removed=False,
        week_completed=done,
        marked_safe=safe,
    )
    assert can_view_meeting_record(actor, **flags) is expected
    for key in ["cancelled", "week_removed"]:
        assert can_view_meeting_record(actor, **{**flags, key: True}) is False
    actor.approved = False
    assert can_view_meeting_record(actor, **flags) is False


def test_anonymous_cannot_view_even_an_explicitly_safe_record():
    assert (
        can_view_meeting_record(
            None,
            cancelled=False,
            linked_week=False,
            week_removed=False,
            week_completed=False,
            marked_safe=True,
        )
        is False
    )
