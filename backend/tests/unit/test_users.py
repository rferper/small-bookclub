from datetime import datetime

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone

from users.models import User


def validate(user):
    # Unit checks never query uniqueness or SQL constraints.
    user.full_clean(validate_unique=False, validate_constraints=False)


def account(**fields):
    return User(discord_user_id="12345678901234567", display_name="Luna", **fields)


def test_custom_identity_and_deny_by_default():
    user = account()
    assert get_user_model() is User
    assert User.USERNAME_FIELD == "discord_user_id"
    assert User.REQUIRED_FIELDS == ["display_name"]
    assert user.pk is None
    assert user.role == "member"
    assert user.approved is False
    assert user.revoked_at is None
    assert not user.is_active
    assert not user.has_usable_password()
    assert user.avatar_path == ""
    assert user.bio is user.favourite_quote is None
    assert user.last_login is None
    names = {field.name for field in User._meta.fields}
    assert not {"username", "email", "is_active", "is_staff", "is_superuser"} & names


@pytest.mark.parametrize("role", ["member", "admin"])
@pytest.mark.parametrize("approved", [False, True])
@pytest.mark.parametrize("revoked", [False, True])
def test_effective_access_truth_table(role, approved, revoked):
    user = account(
        role=role, approved=approved, revoked_at=timezone.now() if revoked else None
    )
    assert user.is_active is (approved and not revoked)
    with pytest.raises(AttributeError):
        user.is_active = True
    if approved and revoked:
        with pytest.raises(ValidationError):
            validate(user)
    else:
        validate(user)


@pytest.mark.parametrize(
    "identity",
    [
        None,
        "",
        " ",
        "1" * 16,
        "1" * 21,
        "١" * 17,
        "１" * 17,
        "1" * 16 + "a",
        "1" * 17 + "\n",
        12345678901234567,
    ],
)
def test_invalid_external_identity(identity):
    user = User(discord_user_id=identity, display_name="Luna")
    with pytest.raises(ValidationError):
        validate(user)


@pytest.mark.parametrize("identity", ["1" * 17, "0" * 18, "1" * 19, "9" * 20])
def test_valid_external_identity(identity):
    user = User(discord_user_id=identity, display_name="Luna")
    validate(user)
    assert user.discord_user_id == identity


@pytest.mark.parametrize("role", ["curator", "owner", "", None])
def test_only_member_and_admin_roles(role):
    with pytest.raises(ValidationError):
        validate(account(role=role))


@pytest.mark.parametrize(
    "name",
    [
        None,
        "",
        "  ",
        "a" * 41,
        "Luna\nMar",
        "Luna\rMar",
        "Luna\tMar",
        "Luna\x00Mar",
        "Luna\x7fMar",
        "Luna\u2028Mar",
        "Luna\u2029Mar",
    ],
)
def test_display_name_rules(name):
    user = User(discord_user_id="1" * 17, display_name=name)
    with pytest.raises(ValidationError):
        validate(user)


def test_profile_trims_before_lengths_and_preserves_plain_text():
    user = User(
        discord_user_id="1" * 17,
        display_name="  " + "a" * 40 + "  ",
        bio="  " + "b" * 500 + "  ",
        favourite_quote="  <fictional>\nquote</fictional>  ",
    )
    validate(user)
    assert user.display_name == "a" * 40
    assert user.bio == "b" * 500
    assert user.favourite_quote == "<fictional>\nquote</fictional>"


@pytest.mark.parametrize("value", [None, "", "  \n\t  "])
def test_empty_optional_prose_normalizes_to_null(value):
    user = account(bio=value, favourite_quote=value)
    validate(user)
    assert user.bio is user.favourite_quote is None


@pytest.mark.parametrize("field,limit", [("bio", 500), ("favourite_quote", 300)])
def test_optional_prose_limits(field, limit):
    user = account(**{field: "a" * limit})
    validate(user)
    setattr(user, field, "a" * (limit + 1))
    with pytest.raises(ValidationError):
        validate(user)


def test_naive_revocation_and_local_password_rejected():
    with pytest.raises(ValidationError):
        validate(account(revoked_at=datetime(2026, 1, 1)))
    user = account()
    with pytest.raises(ValueError, match="password"):
        user.set_password("fictional-password")
    user.set_unusable_password()
    assert not user.has_usable_password()
    user.password = "plaintext"
    with pytest.raises(ValidationError):
        validate(user)


def test_malformed_revocation_returns_validation_error():
    with pytest.raises(ValidationError):
        validate(account(revoked_at="fictional-invalid-date"))


def test_async_password_setter_cannot_create_local_password():
    import asyncio

    user = account()
    with pytest.raises(ValueError, match="password"):
        asyncio.run(user.aset_password("fictional-password"))
    assert not user.has_usable_password()


def test_superuser_provisioning_cannot_bypass_first_admin():
    with pytest.raises(ValueError, match="#6"):
        User.objects.create_superuser("1" * 17, display_name="Luna")
