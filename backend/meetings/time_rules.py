"""Pure club-clock decisions; no implicit selection of a DST fold."""

import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def unique_wall_time(wall, zone):
    candidates = set()
    for fold in (0, 1):
        local = wall.replace(tzinfo=zone, fold=fold)
        instant = local.astimezone(timezone.utc)
        if instant.astimezone(zone).replace(tzinfo=None) == wall:
            candidates.add(instant)
    return len(candidates) == 1


def parse_instant(value, club_timezone):
    if not isinstance(value, str) or not re.fullmatch(
        r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"
        r"(?:\.[0-9]{1,6})?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])",
        value,
    ):
        raise ValueError("Invalid offset-required instant")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    zone = ZoneInfo(club_timezone)
    # UTC is an absolute instant. Other spellings may describe club wall time;
    # reject nonexistent/ambiguous wall time when their offset is a club offset.
    wall = parsed.replace(tzinfo=None)
    possible_offsets = {
        wall.replace(tzinfo=zone, fold=fold).utcoffset() for fold in (0, 1)
    }
    if (
        parsed.utcoffset() != timezone.utc.utcoffset(None)
        and parsed.utcoffset() in possible_offsets
    ):
        if not unique_wall_time(wall, zone):
            raise ValueError("Ambiguous or nonexistent club wall time")
    local_wall = parsed.astimezone(zone).replace(tzinfo=None)
    if not unique_wall_time(local_wall, zone):
        raise ValueError("Ambiguous club wall time")
    return parsed.astimezone(timezone.utc)


def attendance_eligible(starts_at, cancelled, now):
    return cancelled is False and starts_at < now
