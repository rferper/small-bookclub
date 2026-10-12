"""Effective membership foundation; role and spoiler checks remain separate."""

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
        identity.is_authenticated
        and identity.pk is not None
        and not identity._state.adding
        and identity.approved is True
        and identity.revoked_at is None
    )


def approved_admin_refusal(identity):
    """Pure permission decision; curator assignment never supplies admin authority."""
    if identity is None or not is_effective_member(identity):
        return 401
    return None if identity.role == "admin" else 403
