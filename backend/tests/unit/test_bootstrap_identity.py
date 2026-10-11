import pytest
from django.core.exceptions import ValidationError

from users.validators import validate_discord_id


@pytest.mark.parametrize("identity", ["0" * 17, "1" * 18, "2" * 19, "3" * 20])
def test_bootstrap_identity_uses_exact_existing_ascii_rule(identity):
    validate_discord_id(identity)


@pytest.mark.parametrize(
    "identity",
    [
        None,
        "",
        " ",
        "\t\n",
        " " + "1" * 17,
        "1" * 17 + " ",
        "+" + "1" * 17,
        "-" + "1" * 17,
        "x" * 17,
        "1" * 16,
        "1" * 21,
        "١" * 17,
        "１" * 17,
        "1" * 17 + "\n",
        100000000000000001,
    ],
)
def test_bootstrap_identity_rejects_without_normalizing(identity):
    with pytest.raises(ValidationError):
        validate_discord_id(identity)
