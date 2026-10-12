"""Every section 3 matrix row, with trusted server facts and no database."""

from types import SimpleNamespace

import pytest
from django.contrib.auth.models import AnonymousUser

from users.access import (
    PERMISSION_ACTIONS,
    can_edit_profile,
    can_edit_review,
    can_manage_vote,
    can_view_reviews,
    is_current_curator,
    is_effective_member,
    permission_refusal,
    require_permission,
)


def actor(role="member", **changes):
    return SimpleNamespace(
        **{
            "pk": 7,
            "role": role,
            "approved": True,
            "revoked_at": None,
            "is_authenticated": True,
            "_state": SimpleNamespace(adding=False),
            "is_curator": True,
            **changes,
        }
    )


# Expected grants come directly from the spec matrix, independently of policy sets.
MATRIX = [
    ("sign_in", True, True, True),
    ("edit_own_profile", True, True, True),
    ("manage_members", False, False, True),
    ("manage_catalogue", False, False, True),
    ("nominate_books", False, True, True),
    ("cast_own_vote", True, True, True),
    ("close_vote", False, True, True),
    ("record_tie_winner", False, False, True),
    ("mark_own_progress", True, True, True),
    ("edit_own_review", True, True, True),
    ("manage_meetings", False, False, True),
    ("view_reviews", False, False, False),
    ("restore_content", False, False, True),
    ("view_club", True, True, True),
]


@pytest.mark.parametrize("action,member,curator,admin", MATRIX)
@pytest.mark.parametrize("role", ["anonymous", "member", "curator", "admin"])
def test_spec_matrix_denies_anonymous_and_limits_curator(
    action, member, curator, admin, role
):
    identity = (
        None if role == "anonymous" else actor("admin" if role == "admin" else "member")
    )
    expected = {
        "anonymous": False,
        "member": member,
        "curator": curator,
        "admin": admin,
    }[role]
    refusal = permission_refusal(
        identity,
        action,
        owner_id=7,
        curator_id=7 if role == "curator" else 8,
    )
    assert refusal == (None if expected else 401 if role == "anonymous" else 403)


def test_matrix_covers_the_entire_action_inventory():
    assert {row[0] for row in MATRIX} == PERMISSION_ACTIONS


@pytest.mark.parametrize(
    "identity",
    [
        None,
        AnonymousUser(),
        actor(approved=False),
        actor(revoked_at="now"),
        actor(_state=SimpleNamespace(adding=True)),
    ],
)
def test_every_permission_denies_nonmembers_even_with_granting_context(identity):
    assert not is_effective_member(identity)
    for action in PERMISSION_ACTIONS:
        assert (
            permission_refusal(
                identity,
                action,
                owner_id=7,
                curator_id=7,
                personally_finished=True,
                own_review_submitted=True,
            )
            == 401
        )


@pytest.mark.parametrize("role", ["member", "admin"])
@pytest.mark.parametrize("owner", [None, 8, "7", True])
def test_foreign_or_coerced_ownership_never_grants_authority(role, owner):
    identity = actor(role)
    assert not can_edit_profile(identity, owner)
    assert not can_edit_review(identity, owner)
    for action in [
        "edit_own_profile",
        "edit_own_review",
        "cast_own_vote",
        "mark_own_progress",
    ]:
        assert permission_refusal(identity, action, owner_id=owner) == 403


def test_curator_requires_current_server_assignment_not_role_or_flags():
    identity = actor()
    assert is_current_curator(identity, 7)
    for assignment in [None, 8, "7", True]:
        assert not is_current_curator(identity, assignment)
        assert not can_manage_vote(identity, assignment)
    assert not is_current_curator(actor("curator"), None)
    assert can_manage_vote(actor("admin"), None)


@pytest.mark.parametrize("role", ["member", "admin"])
@pytest.mark.parametrize("finished", [False, True, 1, "true"])
@pytest.mark.parametrize("reviewed", [False, True, 1, "true"])
def test_review_visibility_requires_both_server_facts_for_every_role(
    role, finished, reviewed
):
    allowed = finished is True and reviewed is True
    assert (
        can_view_reviews(
            actor(role), personally_finished=finished, own_review_submitted=reviewed
        )
        is allowed
    )
    assert permission_refusal(
        actor(role),
        "view_reviews",
        personally_finished=finished,
        own_review_submitted=reviewed,
    ) == (None if allowed else 403)


@pytest.mark.parametrize(
    "identity,status", [(None, 401), (actor(), 403), (actor("admin"), 200)]
)
def test_guard_rechecks_identity_and_refuses_before_context_or_handler(
    monkeypatch, identity, status
):
    from users import authentication

    calls = []
    request = SimpleNamespace(user=actor("admin"))

    def current(request):
        calls.append("identity")
        request.user = identity
        return identity

    def context(request):
        calls.append("context")
        return {}

    monkeypatch.setattr(authentication, "current_identity", current)

    @require_permission("manage_members", context=context)
    def service(request):
        calls.append("handler")
        return 200, {"ok": True}

    assert service(request)[0] == status
    assert calls == (
        ["identity", "context", "handler"] if status == 200 else ["identity"]
    )


def test_guard_uses_server_owned_context_and_preserves_arguments(monkeypatch):
    from users import authentication

    identity = actor()
    request = SimpleNamespace(user=identity)
    monkeypatch.setattr(authentication, "current_identity", lambda request: identity)

    @require_permission(
        "edit_own_profile", context=lambda request, target: {"owner_id": target}
    )
    def service(request, target):
        return 200, target

    assert service(request, 7) == (200, 7)
    assert service(request, 8)[0] == 403
    assert service.__name__ == "service"


def test_unknown_policy_is_a_programming_error():
    with pytest.raises(ValueError, match="Unknown permission"):
        permission_refusal(actor("admin"), "invented")
    with pytest.raises(ValueError, match="Unknown permission"):
        require_permission("invented")
