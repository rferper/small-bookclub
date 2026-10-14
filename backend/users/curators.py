"""Explicit admin-managed retained curator cycles; account roles are unchanged."""

import json

from django.core.exceptions import SuspiciousOperation
from django.db import transaction
from django.utils import timezone

from .access import approved_admin_refusal, require_permission
from .membership import admin_members_projection, error_result, native_member_id
from .models import CuratorAssignment, User


@transaction.atomic
@require_permission("manage_members")
def set_curator(request):
    actor = User.objects.select_for_update().filter(pk=request.user.pk).first()
    refusal = approved_admin_refusal(actor)
    if refusal:
        return error_result(refusal)
    value = None
    try:
        if request.content_type == "application/json" and len(request.body) <= 4096:
            value = json.loads(request.body)
    except (ValueError, UnicodeDecodeError, SuspiciousOperation):
        pass
    if not isinstance(value, dict) or set(value) != {"memberId"}:
        return error_result(400)
    key = value["memberId"]
    if key is not None and (not isinstance(key, str) or not key):
        return error_result(400)
    target = None
    if key is not None:
        native_id = native_member_id(key)
        target = (
            User.objects.select_for_update()
            .filter(pk=native_id, approved=True, revoked_at=None)
            .first()
            if native_id
            else None
        )
        if target is None:
            return error_result(404)
    existing = (
        CuratorAssignment.objects.select_for_update().filter(current=True).first()
    )
    if existing and target and existing.member_id == target.pk:
        return 200, admin_members_projection(actor)
    now = timezone.now()
    from core.audit import record_audit

    if existing:
        existing.current = False
        existing.ended_at = now
        existing.save(update_fields=["current", "ended_at"])
        record_audit("curator_cleared", actor, "curator", existing.member_id)
    if target:
        CuratorAssignment.objects.create(member=target, assigned_at=now)
        record_audit("curator_assigned", actor, "curator", target.pk)
    return 200, admin_members_projection(actor)
