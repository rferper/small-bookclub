"""Whole-rubric persistence with current admin authority and atomic validation."""

import json

from django.core.exceptions import SuspiciousOperation
from django.db import transaction

from users.access import permission_refusal, require_permission
from users.membership import error_result
from users.models import User

from .models import CRITERIA, RatingRubric


def projection():
    result = {
        criterion: {str(star): None for star in range(1, 6)} for criterion in CRITERIA
    }
    for row in RatingRubric.objects.all():
        result[row.criterion][str(row.star)] = row.description
    return result


@require_permission("view_club")
def read_rubric(request):
    return 200, projection()


def normalize(value):
    if not isinstance(value, dict) or set(value) != set(CRITERIA):
        raise ValueError("Invalid criteria")
    cleaned = []
    for criterion in CRITERIA:
        anchors = value[criterion]
        if not isinstance(anchors, dict) or set(anchors) != {
            str(n) for n in range(1, 6)
        }:
            raise ValueError("Invalid anchors")
        for star, text in anchors.items():
            if text is not None:
                if not isinstance(text, str) or len(text) > 500 or "\x00" in text:
                    raise ValueError("Invalid text")
                # Refuse lone surrogates before a database write can fail halfway.
                text.encode("utf-8")
                text = text.strip() or None
            cleaned.append((criterion, int(star), text))
    return cleaned


@transaction.atomic
@require_permission("manage_catalogue")
def save_rubric(request):
    actor = User.objects.select_for_update().filter(pk=request.user.pk).first()
    refusal = permission_refusal(actor, "manage_catalogue")
    if refusal:
        return error_result(refusal)
    try:
        if request.content_type != "application/json" or len(request.body) > 65536:
            return error_result(400)
        rows = normalize(json.loads(request.body))
    except (ValueError, UnicodeError, SuspiciousOperation):
        return error_result(400)
    for criterion, star, description in rows:
        RatingRubric.objects.update_or_create(
            criterion=criterion, star=star, defaults={"description": description}
        )
    return 200, projection()
