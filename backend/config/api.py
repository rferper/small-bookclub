"""Mounted finite JSON and provider-navigation operations."""

from typing import Annotated, Literal
from urllib.parse import urlsplit

from allauth.socialaccount.adapter import get_adapter
from allauth.socialaccount.internal import statekit
from django.conf import settings
from django.contrib.auth import logout
from django.http import HttpResponse, HttpResponseRedirect
from django.middleware.csrf import get_token
from django.utils import timezone
from ninja import NinjaAPI, Schema, Status
from pydantic import ConfigDict, Field

from users.authentication import (
    DENIED_KEY,
    EXPORT_KEY,
    INTENT_KEY,
    PURPOSE_KEY,
    current_identity,
)
from users.membership import (
    add_member,
    error_result,
    list_members,
    restore_member,
    revoke_member,
)
from users.oauth import ClubDiscordAdapter, callback
from users.schemas import (
    REDIRECT_RESPONSE,
    AdminMembers,
    Error,
    NewMember,
    Session,
    query_parameter,
)

api = NinjaAPI(
    title="Small Bookclub API", version="1.2.0", docs_url=None, openapi_url=None
)


class Health(Schema):
    model_config = ConfigDict(extra="forbid")
    status: Literal["ok"]


@api.get(
    "/health",
    response={200: Health},
    operation_id="getHealth",
    auth=None,
    openapi_extra={"security": []},
)
def health(request):
    return {"status": "ok"}


@api.get(
    "/session",
    response={200: Session, 500: Error, 503: Error},
    operation_id="getSession",
    auth=None,
    openapi_extra={"security": []},
)
def session(request):
    get_token(request)
    identity = current_identity(request)
    if identity is None:
        return {
            "status": "denied" if request.session.get(DENIED_KEY) else "anonymous",
            "demoSignInAvailable": False,
        }
    return {
        "status": "signedIn",
        "user": {
            "id": str(identity.pk),
            "displayName": identity.display_name,
            "avatarUrl": identity.avatar_path or None,
            "role": identity.role,
        },
    }


@api.get(
    "/auth/discord/start",
    response={302: None, 500: Error, 503: Error},
    operation_id="startSignIn",
    auth=None,
    openapi_extra={
        "security": [],
        "parameters": [
            query_parameter(
                "purpose",
                {"type": "string", "enum": ["login", "export"], "default": "login"},
            )
        ],
        "responses": {"302": REDIRECT_RESPONSE},
    },
)
def start_sign_in(request):
    purpose = request.GET.get("purpose", "login")
    identity = current_identity(request)
    request.session.pop(EXPORT_KEY, None)
    request.session.pop(INTENT_KEY, None)
    request.session.pop(statekit.STATES_SESSION_KEY, None)
    if purpose not in {"login", "export"}:
        return HttpResponseRedirect("/")
    request.session.pop(DENIED_KEY, None)
    request.session[PURPOSE_KEY] = purpose
    if purpose == "export":
        if identity is None:
            return HttpResponseRedirect("/")
        if identity.role != "admin":
            return HttpResponseRedirect("/administracion")
    redirect = urlsplit(settings.DISCORD_REDIRECT_URI)
    if (
        not settings.DISCORD_CLIENT_ID
        or not settings.DISCORD_CLIENT_SECRET
        or redirect.scheme not in {"http", "https"}
        or not redirect.netloc
        or redirect.path != "/api/auth/discord/callback"
        or redirect.query
        or redirect.fragment
    ):
        return Status(
            503,
            {
                "code": "service_unavailable",
                "message": "El servicio no está disponible. Inténtalo de nuevo.",
            },
        )
    intent = {"purpose": purpose, "issued": timezone.now().timestamp()}
    if purpose == "export":
        intent.update(id=str(identity.pk), discord=identity.discord_user_id)
    request.session[INTENT_KEY] = intent
    provider = get_adapter(request).get_provider(request, "discord")
    provider.oauth2_adapter_class = ClubDiscordAdapter
    # No browser-supplied scope/auth_params/next/process is passed to allauth.
    return provider.redirect(
        request,
        process="login",
        data=intent,
        scope=["identify"],
        auth_params={"prompt": "consent"} if purpose == "export" else {},
    )


@api.get(
    "/auth/discord/callback",
    response={302: None, 500: Error, 503: Error},
    operation_id="discordCallback",
    auth=None,
    openapi_extra={
        "security": [],
        "parameters": [
            query_parameter(name, {"type": "string"})
            for name in ["code", "state", "error"]
        ],
        "responses": {"302": REDIRECT_RESPONSE},
    },
)
def discord_callback(request):
    return callback(request)


@api.post(
    "/auth/logout",
    response={204: None, 403: Error, 500: Error, 503: Error},
    operation_id="signOut",
    auth=None,
    openapi_extra={"security": [{"csrfHeader": []}]},
)
def sign_out(request):
    logout(request)
    return HttpResponse(status=204)


@api.post(
    "/admin/members/{memberId}/revoke",
    response={
        200: AdminMembers,
        401: Error,
        403: Error,
        404: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="revokeMember",
    openapi_extra={
        "security": [{"sessionCookie": [], "csrfHeader": []}],
    },
)
def revoke(request, memberId: Annotated[str, Field(min_length=1)]):
    try:
        status, result = revoke_member(request, memberId)
    except Exception:
        # Outside atomic: invalidation/storage failures roll back before a safe
        # declared envelope is returned. Never echo exceptions or session data.
        status, result = error_result(500)
    return Status(status, result)


def allowlist_result(operation, *args):
    try:
        status, result = operation(*args)
    except Exception:
        # Exceptions leave the atomic operation before the declared safe envelope.
        status, result = error_result(500)
    return Status(status, result)


@api.get(
    "/admin/members",
    response={200: AdminMembers, 401: Error, 403: Error, 500: Error, 503: Error},
    operation_id="getAdminMembers",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def admin_members(request):
    return allowlist_result(list_members, request)


@api.post(
    "/admin/members",
    response={
        201: AdminMembers,
        400: Error,
        401: Error,
        403: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="addMember",
    openapi_extra={
        "security": [{"sessionCookie": [], "csrfHeader": []}],
        "requestBody": {
            "required": True,
            "content": {"application/json": {"schema": NewMember.model_json_schema()}},
        },
    },
)
def add_admin_member(request):
    # Deliberate raw-body boundary: authorize and check duplicates before validation.
    return allowlist_result(add_member, request)


@api.post(
    "/admin/members/{memberId}/restore",
    response={
        200: AdminMembers,
        401: Error,
        403: Error,
        404: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="restoreMember",
    openapi_extra={"security": [{"sessionCookie": [], "csrfHeader": []}]},
)
def restore(request, memberId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(restore_member, request, memberId)
