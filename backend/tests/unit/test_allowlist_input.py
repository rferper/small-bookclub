import pytest
from django.core.exceptions import ValidationError

from users.membership import native_member_id, new_member_input


@pytest.mark.parametrize("digits", [17, 18, 19, 20])
def test_exact_discord_identity_and_trimmed_website_name(digits):
    identity = "0" + "1" * (digits - 1)
    assert new_member_input({"discordId": identity, "displayName": "  Álvaro  "}) == (
        identity,
        "Álvaro",
    )
    assert (
        new_member_input({"discordId": identity, "displayName": " " + "a" * 40 + " "})[
            1
        ]
        == "a" * 40
    )


@pytest.mark.parametrize(
    "identity",
    [
        None,
        12345678901234567,
        "1" * 16,
        "1" * 21,
        "１" * 17,
        "١" * 17,
        " 12345678901234567",
        "12345678901234567\n",
    ],
)
def test_discord_identity_never_coerces_or_trims(identity):
    with pytest.raises(ValidationError):
        new_member_input({"discordId": identity, "displayName": "Alba"})


@pytest.mark.parametrize(
    "name",
    [
        None,
        5,
        "",
        " ",
        "a" * 41,
        "Alba\n",
        "\tAlba",
        "Al\x00ba",
        "Al\x7fba",
        "Al\u0085ba",
        "Al\u200bba",
        "Al\u2028ba",
        "Al\u2029ba",
    ],
)
def test_name_rejects_empty_long_multiline_and_control_text(name):
    with pytest.raises(ValidationError):
        new_member_input({"discordId": "12345678901234567", "displayName": name})


@pytest.mark.parametrize(
    "value",
    [
        None,
        [],
        "text",
        {},
        {"discordId": "12345678901234567"},
        {"discordId": "12345678901234567", "displayName": "Alba", "role": "admin"},
    ],
)
def test_only_closed_member_input_is_accepted(value):
    with pytest.raises(ValidationError):
        new_member_input(value)


@pytest.mark.parametrize(
    "value", ["opaque", "0", "-1", "1.0", "９", "9" * 100, str(2**63)]
)
def test_invalid_native_targets_fail_closed(value):
    assert native_member_id(value) is None


def test_native_key_supports_database_range_and_padded_decimal():
    assert native_member_id("001") == 1
    assert native_member_id(str(2**63 - 1)) == 2**63 - 1
