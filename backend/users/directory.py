"""Closed website-native projections for the private member directory."""

from .access import require_permission
from .membership import error_result, native_member_id, spanish_name_key
from .models import User


def member_summary(identity):
    return {
        "id": str(identity.pk),
        "displayName": identity.display_name,
        "avatarUrl": identity.avatar_path or None,
    }


@require_permission("view_club")
def directory(request):
    actor = request.user
    rows = sorted(
        User.objects.filter(approved=True, revoked_at=None),
        key=lambda row: (spanish_name_key(row.display_name), row.pk),
    )
    return 200, {
        "currentWeekNumber": None,
        "members": [
            {
                "member": member_summary(row),
                "isMe": row.pk == actor.pk,
                "completedCurrentWeek": None,
            }
            for row in rows
        ],
    }


@require_permission("view_club")
def member_profile(request, member_id):
    actor = request.user
    native_id = native_member_id(member_id)
    target = (
        User.objects.filter(pk=native_id, approved=True, revoked_at=None).first()
        if native_id
        else None
    )
    if target is None:
        return error_result(404)
    return 200, {
        "member": member_summary(target),
        "bio": target.bio,
        "favouriteQuote": target.favourite_quote,
        "favouriteBooks": [],
        "isMe": target.pk == actor.pk,
        "currentWeek": None,
    }
