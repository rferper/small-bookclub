"""Independent manual facts and whole-plan advisory diagnostics."""

import math
import re
from datetime import date
from decimal import Decimal

MAX_SAFE_INTEGER = 9007199254740991
FIELDS = {
    "percentStart",
    "percentEnd",
    "pageStart",
    "pageEnd",
    "dueDate",
    "notes",
    "meetingId",
}


def clean_input(value):
    if not isinstance(value, dict) or set(value) != FIELDS:
        raise ValueError("Invalid reading input")
    for key in ("percentStart", "percentEnd"):
        number = value[key]
        if type(number) not in (int, float) or not math.isfinite(number) or number < 0:
            raise ValueError("Invalid percentage")
    for key in ("pageStart", "pageEnd"):
        if type(value[key]) is not int or not 1 <= value[key] <= MAX_SAFE_INTEGER:
            raise ValueError("Invalid page")
    due = value["dueDate"]
    if due is not None:
        if not isinstance(due, str) or not re.fullmatch(
            r"[0-9]{4}-[0-9]{2}-[0-9]{2}", due
        ):
            raise ValueError("Invalid due date")
        date.fromisoformat(due)
    notes = value["notes"]
    if notes is not None and (
        not isinstance(notes, str) or len(notes.strip()) > 1000 or "\x00" in notes
    ):
        raise ValueError("Invalid notes")
    link = value["meetingId"]
    if link is not None and (not isinstance(link, str) or not link):
        raise ValueError("Invalid meeting")
    return {**value, "notes": notes.strip() or None if notes is not None else None}


def warnings(weeks, page_count):
    """Diagnostic codes only; never rewrite either fact or infer a range."""
    result = []
    for index, week in enumerate(weeks):

        def add(code):
            result.append((index + 1, code))

        ps, pe, start, end = (
            week[key] for key in ("percentStart", "percentEnd", "pageStart", "pageEnd")
        )
        if ps > pe:
            add("reversed_percent")
        if start > end:
            add("reversed_pages")
        if max(ps, pe) > 100:
            add("percent_over_100")
        if page_count is not None and page_count > 0:
            if max(start, end) > page_count:
                add("pages_over_total")
            if any(
                abs(Decimal(str(percent)) - Decimal(100) * page / page_count) > 10
                for percent, page in [(ps, start), (pe, end)]
            ):
                add("discrepancy")
        if not index:
            continue
        previous = weeks[index - 1]
        pps, ppe, pstart, pend = (
            previous[key]
            for key in ("percentStart", "percentEnd", "pageStart", "pageEnd")
        )
        if ps < pps or start < pstart:
            add("backwards")
        if max(min(ps, pe), min(pps, ppe)) < min(max(ps, pe), max(pps, ppe)):
            add("percent_overlap")
        if max(min(start, end), min(pstart, pend)) <= min(
            max(start, end), max(pstart, pend)
        ):
            add("page_overlap")
    return result
