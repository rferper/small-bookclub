from types import SimpleNamespace

import pytest

from users.authentication import fresh_export_auth


def identity(**changes):
    data = {
        "pk": 7,
        "discord_user_id": "12345678901234567",
        "is_authenticated": True,
        "approved": True,
        "revoked_at": None,
        "role": "admin",
        "_state": SimpleNamespace(adding=False),
    }
    return SimpleNamespace(**(data | changes))


@pytest.mark.parametrize(
    "age,expected", [(0, True), (299, True), (300, False), (-1, False)]
)
def test_export_freshness_finite_server_time(age, expected):
    assert (
        fresh_export_auth(
            identity(),
            {"id": "7", "discord": "12345678901234567", "at": 1000 - age},
            1000,
        )
        is expected
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"pk": 8},
        {"discord_user_id": "98765432109876543"},
        {"role": "member"},
        {"approved": False},
        {"revoked_at": object()},
        {"is_authenticated": False},
        {"pk": None},
    ],
)
def test_export_freshness_requires_same_current_approved_admin(changes):
    assert not fresh_export_auth(
        identity(**changes),
        {"id": "7", "discord": "12345678901234567", "at": 900},
        1000,
    )


@pytest.mark.parametrize(
    "record",
    [
        None,
        {},
        {"id": "7", "at": 900},
        {"id": "7", "discord": None, "at": 900},
        {"id": "7", "discord": "12345678901234567", "at": True},
        {"id": "7", "discord": "12345678901234567", "at": "900"},
        {"id": "7", "discord": "12345678901234567", "at": float("nan")},
        {"id": "7", "discord": "12345678901234567", "at": float("inf")},
    ],
)
def test_export_freshness_rejects_invalid_records(record):
    assert not fresh_export_auth(identity(), record, 1000)
