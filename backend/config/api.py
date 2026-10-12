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

from books.catalogue import list_catalogue, read_book, save_book, serve_cover
from books.library import list_books
from books.library import read_book as read_member_book
from books.metadata import search_metadata
from meetings.calendar import (
    deletion_preview,
    list_calendar,
    read_meeting,
    remove_meeting,
    save_meeting,
    set_cancelled,
)
from meetings.reading_plan import read_plan, remove_week, reorder_weeks, save_week
from meetings.reading_schemas import (
    AdminReadingPlan,
    ReadingWeekOrder,
    write_schema,
)
from meetings.schemas import (
    AdminMeeting,
    AdminMeetingCalendar,
    CancelledInput,
    DeletionPreview,
    MeetingInput,
    RecycleBinEntry,
)
from users.authentication import (
    DENIED_KEY,
    EXPORT_KEY,
    INTENT_KEY,
    PURPOSE_KEY,
    current_identity,
)
from users.directory import directory, member_profile
from users.membership import (
    add_member,
    error_result,
    list_members,
    restore_member,
    revoke_member,
)
from users.oauth import ClubDiscordAdapter, callback
from users.profile import read_profile, serve_avatar, update_profile
from users.schemas import (
    REDIRECT_RESPONSE,
    AdminBook,
    AdminMembers,
    BookDetail,
    BookMetadataResult,
    Error,
    LibraryBook,
    MemberDirectory,
    MemberProfile,
    MyProfile,
    NewMember,
    Session,
    query_parameter,
)

from .contract import normalize_schema, read_contract, resolve

PROFILE_MULTIPART_SCHEMA = resolve(
    read_contract(), {"$ref": "#/components/schemas/ProfileMultipart"}
)
BOOK_MULTIPART_SCHEMA = normalize_schema(
    resolve(read_contract(), {"$ref": "#/components/schemas/BookMultipart"})
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


@api.get(
    "/me/profile",
    response={200: MyProfile, 401: Error, 500: Error, 503: Error},
    operation_id="getMyProfile",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_my_profile(request):
    return allowlist_result(read_profile, request)


@api.put(
    "/me/profile",
    response={
        200: MyProfile,
        400: Error,
        401: Error,
        403: Error,
        500: Error,
        503: Error,
    },
    operation_id="updateMyProfile",
    openapi_extra={
        "security": [{"sessionCookie": [], "csrfHeader": []}],
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": PROFILE_MULTIPART_SCHEMA,
                    "encoding": {
                        "metadata": {"contentType": "application/json"},
                        "avatar": {"contentType": "image/jpeg, image/png, image/webp"},
                    },
                }
            },
        },
    },
)
def put_my_profile(request):
    return allowlist_result(update_profile, request)


@api.get(
    "/media/avatars/{avatarId}",
    response={200: None, 401: Error, 404: Error, 500: Error, 503: Error},
    operation_id="getAvatar",
    openapi_extra={
        "security": [{"sessionCookie": []}],
        "responses": {
            "200": {
                "description": "WebP image bytes.",
                "content": {
                    "image/webp": {"schema": {"type": "string", "format": "binary"}}
                },
            }
        },
    },
)
def get_avatar(request, avatarId: str):
    try:
        result = serve_avatar(request, avatarId)
    except Exception:
        return Status(*error_result(500))
    if isinstance(result, HttpResponse):
        return result
    return Status(*result)


@api.get(
    "/members",
    response={200: MemberDirectory, 401: Error, 500: Error, 503: Error},
    operation_id="listMembers",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_directory(request):
    return allowlist_result(directory, request)


@api.get(
    "/members/{memberId}",
    response={200: MemberProfile, 401: Error, 404: Error, 500: Error, 503: Error},
    operation_id="getMemberProfile",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_member_profile(request, memberId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(member_profile, request, memberId)


@api.get(
    "/admin/books",
    response={200: list[AdminBook], 401: Error, 403: Error, 500: Error, 503: Error},
    operation_id="listAdminBooks",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def admin_books(request):
    return allowlist_result(list_catalogue, request)


@api.get(
    "/admin/books/{bookId}",
    response={
        200: AdminBook,
        401: Error,
        403: Error,
        404: Error,
        500: Error,
        503: Error,
    },
    operation_id="getAdminBook",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def admin_book(request, bookId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(read_book, request, bookId)


BOOK_REQUEST = {
    "security": [{"sessionCookie": [], "csrfHeader": []}],
    "requestBody": {
        "required": True,
        "content": {
            "multipart/form-data": {
                "schema": BOOK_MULTIPART_SCHEMA,
                "encoding": {
                    "metadata": {"contentType": "application/json"},
                    "cover": {"contentType": "image/jpeg, image/png, image/webp"},
                },
            }
        },
    },
}


@api.post(
    "/admin/books",
    response={
        201: AdminBook,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="createBook",
    openapi_extra=BOOK_REQUEST,
)
def create_book(request):
    return allowlist_result(save_book, request)


@api.put(
    "/admin/books/{bookId}",
    response={
        200: AdminBook,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="updateBook",
    openapi_extra=BOOK_REQUEST,
)
def update_book(request, bookId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(save_book, request, bookId)


@api.get(
    "/media/covers/{coverId}",
    response={200: None, 401: Error, 404: Error, 500: Error, 503: Error},
    operation_id="getCover",
    openapi_extra={
        "security": [{"sessionCookie": []}],
        "responses": {
            "200": {
                "description": "WebP image bytes.",
                "content": {
                    "image/webp": {"schema": {"type": "string", "format": "binary"}}
                },
            }
        },
    },
)
def get_cover(request, coverId: str):
    try:
        result = serve_cover(request, coverId)
    except Exception:
        return Status(*error_result(500))
    return result if isinstance(result, HttpResponse) else Status(*result)


@api.get(
    "/admin/book-metadata",
    response={
        200: list[BookMetadataResult],
        400: Error,
        401: Error,
        403: Error,
        500: Error,
        503: Error,
    },
    operation_id="searchBookMetadata",
    openapi_extra={
        "security": [{"sessionCookie": []}],
        "parameters": [
            {
                "name": "query",
                "in": "query",
                "required": True,
                "schema": {
                    "type": "string",
                    "maxLength": 200,
                    "minLength": 1,
                    "x-trimmedMaxLength": 200,
                    "x-trimmedMinLength": 1,
                },
            }
        ],
    },
)
def book_metadata(request):
    return allowlist_result(search_metadata, request)


@api.get(
    "/books",
    response={200: list[LibraryBook], 401: Error, 500: Error, 503: Error},
    operation_id="listBooks",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def books(request):
    return allowlist_result(list_books, request)


@api.get(
    "/books/{bookId}",
    response={200: BookDetail, 401: Error, 404: Error, 500: Error, 503: Error},
    operation_id="getBook",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def book_detail(request, bookId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(read_member_book, request, bookId)


@api.get(
    "/admin/meetings",
    response={
        200: AdminMeetingCalendar,
        401: Error,
        403: Error,
        500: Error,
        503: Error,
    },
    operation_id="listAdminMeetings",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def admin_calendar(request):
    return allowlist_result(list_calendar, request)


@api.get(
    "/admin/meetings/{meetingId}",
    response={
        200: AdminMeeting,
        401: Error,
        403: Error,
        404: Error,
        500: Error,
        503: Error,
    },
    operation_id="getAdminMeeting",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def admin_meeting(request, meetingId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(read_meeting, request, meetingId)


MEETING_REQUEST = {
    "security": [{"sessionCookie": [], "csrfHeader": []}],
    "requestBody": {
        "required": True,
        "content": {"application/json": {"schema": MeetingInput.model_json_schema()}},
    },
}


@api.post(
    "/admin/meetings",
    response={
        201: AdminMeeting,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="createMeeting",
    openapi_extra=MEETING_REQUEST,
)
def create_meeting(request):
    return allowlist_result(save_meeting, request)


@api.put(
    "/admin/meetings/{meetingId}",
    response={
        200: AdminMeeting,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="updateMeeting",
    openapi_extra=MEETING_REQUEST,
)
def update_meeting(request, meetingId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(save_meeting, request, meetingId)


@api.put(
    "/admin/meetings/{meetingId}/cancelled",
    response={
        200: AdminMeeting,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        500: Error,
        503: Error,
    },
    operation_id="setMeetingCancelled",
    openapi_extra={
        "security": [{"sessionCookie": [], "csrfHeader": []}],
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {"schema": CancelledInput.model_json_schema()}
            },
        },
    },
)
def cancel_meeting(request, meetingId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(set_cancelled, request, meetingId)


@api.get(
    "/admin/deletion-preview/{type}/{id}",
    response={
        200: DeletionPreview,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        500: Error,
        503: Error,
    },
    operation_id="getDeletionPreview",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def preview_deletion(
    request,
    type: Annotated[
        str, Field(json_schema_extra={"enum": ["book", "meeting", "quote"]})
    ],
    id: Annotated[str, Field(min_length=1)],
):
    return allowlist_result(deletion_preview, request, type, id)


@api.delete(
    "/admin/meetings/{meetingId}",
    response={
        200: list[RecycleBinEntry],
        401: Error,
        403: Error,
        404: Error,
        500: Error,
        503: Error,
    },
    operation_id="deleteMeeting",
    openapi_extra={"security": [{"sessionCookie": [], "csrfHeader": []}]},
)
def delete_meeting(request, meetingId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(remove_meeting, request, meetingId)


@api.get(
    "/admin/books/{bookId}/reading-plan",
    response={
        200: AdminReadingPlan,
        401: Error,
        403: Error,
        404: Error,
        500: Error,
        503: Error,
    },
    operation_id="getAdminReadingPlan",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def getAdminReadingPlan(request, bookId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(read_plan, request, bookId)


@api.post(
    "/admin/books/{bookId}/reading-plan/weeks",
    response={
        201: AdminReadingPlan,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="createReadingWeek",
    openapi_extra={
        "security": [{"sessionCookie": [], "csrfHeader": []}],
        "requestBody": {
            "required": True,
            "content": {"application/json": {"schema": write_schema()}},
        },
    },
)
def createReadingWeek(request, bookId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(save_week, request, bookId)


@api.put(
    "/admin/books/{bookId}/reading-plan/weeks/order",
    response={
        200: AdminReadingPlan,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        500: Error,
        503: Error,
    },
    operation_id="reorderReadingWeeks",
    openapi_extra={
        "security": [{"sessionCookie": [], "csrfHeader": []}],
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {"schema": ReadingWeekOrder.model_json_schema()}
            },
        },
    },
)
def reorderReadingWeeks(request, bookId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(reorder_weeks, request, bookId)


@api.put(
    "/admin/books/{bookId}/reading-plan/weeks/{weekId}",
    response={
        200: AdminReadingPlan,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="updateReadingWeek",
    openapi_extra={
        "security": [{"sessionCookie": [], "csrfHeader": []}],
        "requestBody": {
            "required": True,
            "content": {"application/json": {"schema": write_schema()}},
        },
    },
)
def updateReadingWeek(
    request,
    bookId: Annotated[str, Field(min_length=1)],
    weekId: Annotated[str, Field(min_length=1)],
):
    return allowlist_result(save_week, request, bookId, weekId)


@api.delete(
    "/admin/books/{bookId}/reading-plan/weeks/{weekId}",
    response={
        200: AdminReadingPlan,
        401: Error,
        403: Error,
        404: Error,
        500: Error,
        503: Error,
    },
    operation_id="removeReadingWeek",
    openapi_extra={"security": [{"sessionCookie": [], "csrfHeader": []}]},
)
def removeReadingWeek(
    request,
    bookId: Annotated[str, Field(min_length=1)],
    weekId: Annotated[str, Field(min_length=1)],
):
    return allowlist_result(remove_week, request, bookId, weekId)
