"""Club timezone/DST and server-time decisions without database or network."""

from datetime import datetime, timedelta, timezone

import pytest

from meetings.time_rules import attendance_eligible, parse_instant


@pytest.mark.parametrize(
    "value,expected",
    [
        ("2026-01-15T19:30:00Z", "2026-01-15T19:30:00+00:00"),
        ("2026-01-15T20:30:00+01:00", "2026-01-15T19:30:00+00:00"),
        ("2026-07-15T20:30:01.123456+02:00", "2026-07-15T18:30:01.123456+00:00"),
        ("2026-01-15T14:30:00-05:00", "2026-01-15T19:30:00+00:00"),
    ],
)
def test_offset_instants_preserve_exact_time(value, expected):
    assert parse_instant(value, "Europe/Madrid").isoformat() == expected


@pytest.mark.parametrize(
    "value",
    [
        None,
        5,
        "2026-01-15",
        "2026-01-15T20:30:00",
        "0000-01-15T19:30:00Z",
        "2026-02-30T19:30:00Z",
        "2026-01-15T19:30:00+25:00",
        "2026-01-15T19:30:00+01:60",
        "2026-03-29T02:30:00+01:00",
        "2026-10-25T02:30:00+02:00",
        "2026-10-25T02:30:00+01:00",
        "2026-10-25T00:30:00Z",
    ],
)
def test_invalid_naive_gap_or_fold_instants_are_refused(value):
    with pytest.raises(ValueError):
        parse_instant(value, "Europe/Madrid")


def test_different_configured_timezone_and_real_post_gap_instant():
    assert parse_instant("2026-07-15T19:30:00+05:45", "Asia/Kathmandu").hour == 13
    assert parse_instant("2026-03-29T01:30:00Z", "Europe/Madrid").hour == 1


@pytest.mark.parametrize("cancelled", [False, True])
@pytest.mark.parametrize("offset", [-1, 0, 1])
def test_attendance_requires_strictly_past_and_not_cancelled(cancelled, offset):
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert attendance_eligible(now + timedelta(seconds=offset), cancelled, now) is (
        offset < 0 and not cancelled
    )
