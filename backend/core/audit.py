"""Transaction-only audit recorder and fixed safe metadata projections."""

from django.core.exceptions import PermissionDenied
from django.db import transaction

from users.access import permission_refusal, require_permission
from users.models import CuratorAssignment, User

from .models import AuditEvent

LABELS = {
    "member": "Miembro",
    "curator": "Curaduría",
    "book": "Libro",
    "meeting": "Reunión",
    "highlight": "Momento destacado",
    "week": "Semana de lectura",
    "quote": "Cita literaria",
    "vote": "Votación",
    "club": "Club de lectura",
}


def record_audit(action, actor, target_type, target_id):
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("Audit events must share the business transaction")
    current = User.objects.select_for_update().filter(pk=actor.pk).first()
    context = {}
    permission = "restore_content"
    if action == "vote_closed":
        permission = "close_vote"
        assignment = (
            CuratorAssignment.objects.select_for_update().filter(current=True).first()
        )
        context = {"curator_id": assignment.member_id if assignment else None}
    if permission_refusal(current, permission, **context) is not None:
        raise PermissionDenied("Current authority required for audit attribution")
    return AuditEvent.objects.create(
        action=action,
        actor=current,
        actor_name=current.display_name,
        target_type=target_type,
        target_id=str(target_id),
        target_label=LABELS[target_type],
    )


def projection(event):
    return {
        "id": str(event.pk),
        "action": event.action,
        "target": {
            "type": event.target_type,
            "id": event.target_id,
            "label": event.target_label,
        },
        "actor": {"id": str(event.actor_id), "displayName": event.actor_name},
        "occurredAt": event.occurred_at,
    }


def audit_projection():
    return [
        projection(event)
        for event in AuditEvent.objects.order_by("-occurred_at", "-pk")
    ]


@require_permission("restore_content")
def read_audit(request):
    return 200, audit_projection()
