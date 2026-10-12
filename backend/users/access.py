"""Central pure permission policy and current-identity service guards.

Context IDs and completion flags must come from persisted server state. These
helpers decide authority, while services enforce domain lifecycle and CSRF.
"""

from functools import wraps

PUBLIC_OPERATIONS = frozenset(
    {
        ("GET", "/api/health"),
        ("GET", "/api/session"),
        ("GET", "/api/auth/discord/start"),
        ("GET", "/api/auth/discord/callback"),
        ("POST", "/api/auth/logout"),
        ("POST", "/api/auth/demo"),
    }
)


def is_public_operation(method, path):
    return (method, path) in PUBLIC_OPERATIONS


def is_effective_member(identity):
    """Pure decision on a current persisted identity, never browser claims."""
    return (
        identity is not None
        and identity.is_authenticated
        and identity.pk is not None
        and not identity._state.adding
        and identity.approved is True
        and identity.revoked_at is None
    )


def approved_admin_refusal(identity):
    """Pure permission decision; curator assignment never supplies admin authority."""
    return permission_refusal(identity, "manage_members")


def is_admin(identity):
    return is_effective_member(identity) and identity.role == "admin"


def is_current_curator(identity, curator_id):
    # A stored assignment, not a global role or an is_curator browser flag.
    return owns(identity, curator_id)


def owns(identity, owner_id):
    return (
        is_effective_member(identity)
        and owner_id is not None
        and type(identity.pk) is type(owner_id)
        and identity.pk == owner_id
    )


def can_edit_profile(identity, owner_id):
    return owns(identity, owner_id)


def can_edit_review(identity, owner_id):
    # Admin has no implicit moderation override for another member's review.
    return owns(identity, owner_id)


def can_manage_vote(identity, curator_id):
    return is_admin(identity) or is_current_curator(identity, curator_id)


def can_view_reviews(identity, *, personally_finished, own_review_submitted):
    # All books, including historical books, and all roles share this gate.
    return (
        is_effective_member(identity)
        and personally_finished is True
        and own_review_submitted is True
    )


MEMBER_ACTIONS = frozenset({"sign_in", "view_club"})
ADMIN_ACTIONS = frozenset(
    {
        "manage_members",
        "manage_catalogue",
        "record_tie_winner",
        "manage_meetings",
        "restore_content",
    }
)
OWN_ACTIONS = frozenset(
    {"edit_own_profile", "cast_own_vote", "mark_own_progress", "edit_own_review"}
)
CURATOR_ACTIONS = frozenset({"nominate_books", "close_vote"})
PERMISSION_ACTIONS = (
    MEMBER_ACTIONS | ADMIN_ACTIONS | OWN_ACTIONS | CURATOR_ACTIONS | {"view_reviews"}
)


def permission_refusal(
    identity,
    action,
    *,
    owner_id=None,
    curator_id=None,
    personally_finished=False,
    own_review_submitted=False,
):
    """Return 401/403 or None, with membership preceding all authority checks."""
    if action not in PERMISSION_ACTIONS:
        raise ValueError("Unknown permission action")
    if not is_effective_member(identity):
        return 401
    if action in MEMBER_ACTIONS:
        allowed = True
    elif action in ADMIN_ACTIONS:
        allowed = is_admin(identity)
    elif action in OWN_ACTIONS:
        allowed = owns(identity, owner_id)
    elif action in CURATOR_ACTIONS:
        allowed = can_manage_vote(identity, curator_id)
    else:
        allowed = can_view_reviews(
            identity,
            personally_finished=personally_finished,
            own_review_submitted=own_review_submitted,
        )
    return None if allowed else 403


def require_permission(action, *, context=None):
    """Guard tuple-returning Ninja services, before any domain context lookup.

    Optional context(request, *args, **kwargs) must load server-owned facts.
    Decorate within the transaction for mutating operations that need locking;
    recheck authority after acquiring domain locks as appropriate.
    """
    if action not in PERMISSION_ACTIONS:
        raise ValueError("Unknown permission action")

    def decorate(handler):
        @wraps(handler)
        def guarded(request, *args, **kwargs):
            # Local imports avoid a cycle with authentication's pure policy use.
            from .authentication import current_identity
            from .membership import error_result

            actor = current_identity(request)
            if not is_effective_member(actor):
                return error_result(401)
            if action in ADMIN_ACTIONS and not is_admin(actor):
                return error_result(403)
            facts = context(request, *args, **kwargs) if context else {}
            refusal = permission_refusal(actor, action, **facts)
            if refusal:
                return error_result(refusal)
            return handler(request, *args, **kwargs)

        return guarded

    return decorate
