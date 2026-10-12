from types import SimpleNamespace

import pytest

from users.access import PUBLIC_OPERATIONS, is_effective_member, is_public_operation


@pytest.mark.parametrize("role", ["admin", "member", "curator"])
@pytest.mark.parametrize(
    "approved,revoked", [(True, None), (False, None), (False, "now")]
)
@pytest.mark.parametrize("persisted", [True, False])
@pytest.mark.parametrize("authenticated", [True, False])
def test_admin_authority_requires_effective_native_membership(
    role, approved, revoked, persisted, authenticated
):
    from users.access import approved_admin_refusal

    identity = SimpleNamespace(
        role=role,
        approved=approved,
        revoked_at=revoked,
        is_authenticated=authenticated,
        pk=1 if persisted else None,
        _state=SimpleNamespace(adding=not persisted),
        is_curator=True,
    )
    effective = authenticated and persisted and approved and revoked is None
    assert approved_admin_refusal(identity) == (
        401 if not effective else None if role == "admin" else 403
    )


def test_missing_identity_has_no_admin_authority():
    from users.access import approved_admin_refusal

    assert approved_admin_refusal(None) == 401


@pytest.mark.parametrize("role", ["member", "admin", "curator"])
@pytest.mark.parametrize("authenticated", [True, False])
@pytest.mark.parametrize("persisted", [True, False])
@pytest.mark.parametrize(
    "approved,revoked", [(True, None), (False, None), (False, "now"), (True, "now")]
)
def test_membership_requires_current_persisted_approved_identity(
    role, authenticated, persisted, approved, revoked
):
    identity = SimpleNamespace(
        role=role,
        is_authenticated=authenticated,
        pk=1 if persisted else None,
        _state=SimpleNamespace(adding=not persisted),
        approved=approved,
        revoked_at=revoked,
    )
    assert is_effective_member(identity) == (
        authenticated and persisted and approved and revoked is None
    )


@pytest.mark.parametrize("method,path", sorted(PUBLIC_OPERATIONS))
def test_public_boundary_matches_only_exact_method_and_path(method, path):
    assert is_public_operation(method, path)
    for alternative in [path + "/", path + "/secret", path + "x", "/prefix" + path]:
        assert not is_public_operation(method, alternative)
    for alternative in {
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "HEAD",
        "OPTIONS",
        "TRACE",
    } - {method}:
        assert not is_public_operation(alternative, path)


def test_unsaved_identity_with_explicit_key_is_ineligible():
    identity = SimpleNamespace(
        is_authenticated=True,
        pk=42,
        _state=SimpleNamespace(adding=True),
        approved=True,
        revoked_at=None,
    )
    assert not is_effective_member(identity)
