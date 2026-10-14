"""Retained native literary quote management and per-visit selection."""

import json
from random import choice

from django.core.exceptions import SuspiciousOperation
from django.db import IntegrityError, transaction

from users.access import approved_admin_refusal, require_permission
from users.membership import error_result, native_member_id
from users.models import User

from .models import LiteraryQuote
from .quote_rules import normalize_quote


def quote_projection(row):
    return {field: getattr(row, field) for field in ("text", "author", "source")}


def admin_projection(row):
    return {"id": str(row.pk), **quote_projection(row), "active": row.active}


def random_quote():
    rows = list(LiteraryQuote.objects.filter(active=True).order_by("pk"))
    return quote_projection(choice(rows)) if rows else None


@require_permission("manage_catalogue")
def list_quotes(request):
    return 200, [admin_projection(row) for row in LiteraryQuote.objects.order_by("pk")]


def locked_actor(request):
    actor = User.objects.select_for_update().filter(pk=request.user.pk).first()
    refusal = approved_admin_refusal(actor)
    if not refusal:
        request.user = actor
    return refusal


def lookup(resource_id):
    key = native_member_id(resource_id)
    return (
        LiteraryQuote.objects.select_for_update().filter(pk=key).first()
        if key
        else None
    )


@transaction.atomic
@require_permission("manage_catalogue")
def save_quote(request, resource_id=None):
    refusal = locked_actor(request)
    if refusal:
        return error_result(refusal)
    row = lookup(resource_id) if resource_id is not None else LiteraryQuote()
    if row is None:
        return error_result(404)
    try:
        if request.content_type != "application/json" or len(request.body) > 32768:
            return error_result(400)
        values = normalize_quote(json.loads(request.body))
    except (ValueError, UnicodeError, SuspiciousOperation):
        return error_result(400)
    for field, value in values.items():
        setattr(row, field, value)
    try:
        with transaction.atomic():
            row.save()
    except IntegrityError:
        return error_result(409)
    return (201 if resource_id is None else 200), admin_projection(row)


@transaction.atomic
@require_permission("manage_catalogue")
def remove_quote(request, resource_id):
    refusal = locked_actor(request)
    if refusal:
        return error_result(refusal)
    row = lookup(resource_id)
    if row is None:
        return error_result(404)
    row.soft_delete(request.user)
    from meetings.calendar import bin_projection

    return 200, bin_projection()
