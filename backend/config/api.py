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
from books.completion import read_completion, set_finished
from books.home import read_home
from books.home_schemas import HomeData
from books.library import list_books
from books.library import read_book as read_member_book
from books.metadata import search_metadata
from books.schemas import BookRatings, FinishedInput
from core.audit import read_audit
from core.export import backup_info, export_club
from core.quote_schemas import AdminLiteraryQuote, LiteraryQuoteInput
from core.quotes import list_quotes, remove_quote, save_quote
from core.recycle import list_bin, purge_deleted, remove_book, restore_deleted
from meetings.attendance import set_attendance
from meetings.calendar import (
    deletion_preview,
    list_calendar,
    read_meeting,
    remove_meeting,
    save_meeting,
    set_cancelled,
)
from meetings.completion import set_completed
from meetings.member_calendar import list_meetings
from meetings.member_calendar import read_meeting as read_member_meeting
from meetings.reading_plan import read_plan, remove_week, reorder_weeks, save_week
from meetings.reading_schemas import (
    AdminReadingPlan,
    ReadingWeekOrder,
    WeekCompletionInput,
    write_schema,
)
from meetings.record_schemas import (
    AdminMeetingRecord,
    IdOrder,
    MeetingHighlightInput,
    MeetingSummaryInput,
    SafeInput,
)
from meetings.records import mutate_record, read_record
from meetings.schemas import (
    AdminMeeting,
    AdminMeetingCalendar,
    AttendanceInput,
    CancelledInput,
    DeletionPreview,
    MeetingDetail,
    MeetingInput,
    MeetingList,
    RecycleBinEntry,
)
from reviews.rubric import read_rubric, save_rubric
from reviews.schemas import RatingRubric, RatingRubricInput, ReviewInput
from reviews.services import save_review
from reviews.statistics_schemas import Statistics, TasteCompatibility
from reviews.statistics_services import read_compatibility, read_statistics
from users.authentication import (
    DENIED_KEY,
    EXPORT_KEY,
    INTENT_KEY,
    PURPOSE_KEY,
    current_identity,
)
from users.curators import set_curator
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
    CuratorInput,
    Error,
    LibraryBook,
    MemberDirectory,
    MemberProfile,
    MyProfile,
    NewMember,
    Session,
    query_parameter,
)
from votes.schemas import (
    ApprovalInput,
    CandidateInput,
    CandidateOrderInput,
    TieWinnerInput,
    Vote,
    VotesOverview,
)
from votes.services import (
    add_candidate,
    close_vote,
    create_vote,
    list_votes,
    open_vote,
    read_vote,
    record_tie_winner,
    remove_candidate,
    reorder_candidates,
    set_approval,
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


@api.put(
    "/weeks/{weekId}/completion",
    response={
        204: None,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        500: Error,
        503: Error,
    },
    operation_id="setWeekCompleted",
    openapi_extra={
        "security": [{"sessionCookie": [], "csrfHeader": []}],
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {"schema": WeekCompletionInput.model_json_schema()}
            },
        },
    },
)
def set_week_completed(request, weekId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(set_completed, request, weekId)


@api.get(
    "/books/{bookId}/ratings",
    response={200: BookRatings, 401: Error, 404: Error, 500: Error, 503: Error},
    operation_id="getBookRatings",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_book_ratings(request, bookId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(read_completion, request, bookId)


@api.put(
    "/books/{bookId}/finished",
    response={
        200: BookRatings,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="setBookFinished",
    openapi_extra={
        "security": [{"sessionCookie": [], "csrfHeader": []}],
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {"schema": FinishedInput.model_json_schema()}
            },
        },
    },
)
def set_book_finished(request, bookId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(set_finished, request, bookId)


@api.get(
    "/home",
    response={200: HomeData, 401: Error, 500: Error, 503: Error},
    operation_id="getHome",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_home(request):
    return allowlist_result(read_home, request)


@api.get(
    "/meetings",
    response={200: MeetingList, 401: Error, 500: Error, 503: Error},
    operation_id="listMeetings",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def list_member_meetings(request):
    return allowlist_result(list_meetings, request)


@api.get(
    "/meetings/{meetingId}",
    response={200: MeetingDetail, 401: Error, 404: Error, 500: Error, 503: Error},
    operation_id="getMeeting",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_member_meeting(request, meetingId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(read_member_meeting, request, meetingId)


@api.put(
    "/admin/meetings/{meetingId}/attendance",
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
    operation_id="setMeetingAttendance",
    openapi_extra={
        "security": [{"sessionCookie": [], "csrfHeader": []}],
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {"schema": AttendanceInput.model_json_schema()}
            },
        },
    },
)
def set_meeting_attendance(request, meetingId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(set_attendance, request, meetingId)


RECORD_ERRORS = {401: Error, 403: Error, 404: Error, 500: Error, 503: Error}
RECORD_WRITE_ERRORS = {400: Error, **RECORD_ERRORS}


def record_request(schema):
    document = schema.model_json_schema()
    if "$defs" in document:
        document = resolve(document, document)
        document.pop("$defs", None)
    return {
        "security": [{"sessionCookie": [], "csrfHeader": []}],
        "requestBody": {
            "required": True,
            "content": {"application/json": {"schema": document}},
        },
    }


@api.get(
    "/admin/meetings/{meetingId}/record",
    response={200: AdminMeetingRecord, **RECORD_ERRORS},
    operation_id="getAdminMeetingRecord",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_admin_record(request, meetingId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(read_record, request, meetingId)


@api.put(
    "/admin/meetings/{meetingId}/record/summary",
    response={200: AdminMeetingRecord, **RECORD_WRITE_ERRORS},
    operation_id="saveMeetingSummary",
    openapi_extra=record_request(MeetingSummaryInput),
)
def save_meeting_summary(request, meetingId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(mutate_record, request, meetingId, "summary")


@api.post(
    "/admin/meetings/{meetingId}/record/highlights",
    response={201: AdminMeetingRecord, **RECORD_WRITE_ERRORS},
    operation_id="createMeetingHighlight",
    openapi_extra=record_request(MeetingHighlightInput),
)
def create_highlight(request, meetingId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(mutate_record, request, meetingId, "create")


@api.put(
    "/admin/meetings/{meetingId}/record/highlights/order",
    response={200: AdminMeetingRecord, **RECORD_WRITE_ERRORS},
    operation_id="reorderMeetingHighlights",
    openapi_extra=record_request(IdOrder),
)
def reorder_highlights(request, meetingId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(mutate_record, request, meetingId, "order")


@api.put(
    "/admin/meetings/{meetingId}/record/highlights/{highlightId}",
    response={200: AdminMeetingRecord, **RECORD_WRITE_ERRORS},
    operation_id="updateMeetingHighlight",
    openapi_extra=record_request(MeetingHighlightInput),
)
def update_highlight(
    request,
    meetingId: Annotated[str, Field(min_length=1)],
    highlightId: Annotated[str, Field(min_length=1)],
):
    return allowlist_result(mutate_record, request, meetingId, "update", highlightId)


@api.delete(
    "/admin/meetings/{meetingId}/record/highlights/{highlightId}",
    response={200: AdminMeetingRecord, **RECORD_ERRORS},
    operation_id="removeMeetingHighlight",
    openapi_extra={"security": [{"sessionCookie": [], "csrfHeader": []}]},
)
def remove_highlight(
    request,
    meetingId: Annotated[str, Field(min_length=1)],
    highlightId: Annotated[str, Field(min_length=1)],
):
    return allowlist_result(mutate_record, request, meetingId, "remove", highlightId)


@api.put(
    "/admin/meetings/{meetingId}/record/safe",
    response={200: AdminMeetingRecord, 409: Error, **RECORD_WRITE_ERRORS},
    operation_id="setMeetingRecordSafe",
    openapi_extra=record_request(SafeInput),
)
def set_record_safe(request, meetingId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(mutate_record, request, meetingId, "safe")


@api.put(
    "/admin/curator",
    response={
        200: AdminMembers,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        500: Error,
        503: Error,
    },
    operation_id="setCurator",
    openapi_extra=record_request(CuratorInput),
)
def set_current_curator(request):
    return allowlist_result(set_curator, request)


@api.get(
    "/votes",
    response={200: VotesOverview, 401: Error, 500: Error, 503: Error},
    operation_id="getVotes",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_votes(request):
    return allowlist_result(list_votes, request)


@api.post(
    "/votes",
    response={
        201: Vote,
        401: Error,
        403: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="createVote",
    openapi_extra={"security": [{"sessionCookie": [], "csrfHeader": []}]},
)
def post_vote(request):
    return allowlist_result(create_vote, request)


@api.get(
    "/votes/{voteId}",
    response={200: Vote, 401: Error, 404: Error, 500: Error, 503: Error},
    operation_id="getVote",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_vote(request, voteId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(read_vote, request, voteId)


VOTE_MANAGE_ERRORS = {
    401: Error,
    403: Error,
    404: Error,
    409: Error,
    500: Error,
    503: Error,
}


@api.post(
    "/votes/{voteId}/candidates",
    response={200: Vote, 400: Error, **VOTE_MANAGE_ERRORS},
    operation_id="addCandidate",
    openapi_extra=record_request(CandidateInput),
)
def post_candidate(request, voteId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(add_candidate, request, voteId)


@api.put(
    "/votes/{voteId}/candidates/order",
    response={200: Vote, 400: Error, **VOTE_MANAGE_ERRORS},
    operation_id="reorderCandidates",
    openapi_extra=record_request(CandidateOrderInput),
)
def put_candidate_order(request, voteId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(reorder_candidates, request, voteId)


@api.delete(
    "/votes/{voteId}/candidates/{bookId}",
    response={200: Vote, **VOTE_MANAGE_ERRORS},
    operation_id="removeCandidate",
    openapi_extra={"security": [{"sessionCookie": [], "csrfHeader": []}]},
)
def delete_candidate(
    request,
    voteId: Annotated[str, Field(min_length=1)],
    bookId: Annotated[str, Field(min_length=1)],
):
    return allowlist_result(remove_candidate, request, voteId, bookId)


@api.put(
    "/votes/{voteId}/candidates/{bookId}/approval",
    response={200: Vote, 400: Error, **VOTE_MANAGE_ERRORS},
    operation_id="setApproval",
    openapi_extra=record_request(ApprovalInput),
)
def put_approval(
    request,
    voteId: Annotated[str, Field(min_length=1)],
    bookId: Annotated[str, Field(min_length=1)],
):
    return allowlist_result(set_approval, request, voteId, bookId)


@api.post(
    "/votes/{voteId}/open",
    response={200: Vote, **VOTE_MANAGE_ERRORS},
    operation_id="openVote",
    openapi_extra={"security": [{"sessionCookie": [], "csrfHeader": []}]},
)
def post_open_vote(request, voteId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(open_vote, request, voteId)


@api.post(
    "/votes/{voteId}/close",
    response={200: Vote, **VOTE_MANAGE_ERRORS},
    operation_id="closeVote",
    openapi_extra={"security": [{"sessionCookie": [], "csrfHeader": []}]},
)
def post_close_vote(request, voteId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(close_vote, request, voteId)


@api.post(
    "/votes/{voteId}/tie-winner",
    response={200: Vote, 400: Error, **VOTE_MANAGE_ERRORS},
    operation_id="recordTieWinner",
    openapi_extra=record_request(TieWinnerInput),
)
def post_tie_winner(request, voteId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(record_tie_winner, request, voteId)


@api.get(
    "/rating-rubric",
    response={200: RatingRubric, 401: Error, 500: Error, 503: Error},
    operation_id="getRatingRubric",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_rating_rubric(request):
    return allowlist_result(read_rubric, request)


@api.put(
    "/admin/rating-rubric",
    response={
        200: RatingRubric,
        400: Error,
        401: Error,
        403: Error,
        500: Error,
        503: Error,
    },
    operation_id="saveRatingRubric",
    openapi_extra=record_request(RatingRubricInput),
)
def put_rating_rubric(request):
    return allowlist_result(save_rubric, request)


@api.put(
    "/books/{bookId}/my-review",
    response={
        200: BookRatings,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="saveMyReview",
    openapi_extra=record_request(ReviewInput),
)
def put_my_review(request, bookId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(save_review, request, bookId)


@api.get(
    "/statistics/compatibility",
    response={200: TasteCompatibility, 401: Error, 500: Error, 503: Error},
    operation_id="getTasteCompatibility",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_compatibility(request):
    return allowlist_result(read_compatibility, request)


@api.get(
    "/statistics",
    response={200: Statistics, 401: Error, 500: Error, 503: Error},
    operation_id="getStatistics",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_statistics(request):
    return allowlist_result(read_statistics, request)


@api.get(
    "/admin/quotes",
    response={
        200: list[AdminLiteraryQuote],
        401: Error,
        403: Error,
        500: Error,
        503: Error,
    },
    operation_id="listAdminQuotes",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_quotes(request):
    return allowlist_result(list_quotes, request)


@api.post(
    "/admin/quotes",
    response={
        201: AdminLiteraryQuote,
        400: Error,
        401: Error,
        403: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="addLiteraryQuote",
    openapi_extra=record_request(LiteraryQuoteInput),
)
def post_quote(request):
    return allowlist_result(save_quote, request)


@api.put(
    "/admin/quotes/{id}",
    response={
        200: AdminLiteraryQuote,
        400: Error,
        401: Error,
        403: Error,
        404: Error,
        409: Error,
        500: Error,
        503: Error,
    },
    operation_id="updateLiteraryQuote",
    openapi_extra=record_request(LiteraryQuoteInput),
)
def put_quote(request, id: Annotated[str, Field(min_length=1)]):
    return allowlist_result(save_quote, request, id)


@api.delete(
    "/admin/quotes/{id}",
    response={
        200: list[RecycleBinEntry],
        401: Error,
        403: Error,
        404: Error,
        500: Error,
        503: Error,
    },
    operation_id="deleteLiteraryQuote",
    openapi_extra={"security": [{"sessionCookie": [], "csrfHeader": []}]},
)
def delete_quote(request, id: Annotated[str, Field(min_length=1)]):
    return allowlist_result(remove_quote, request, id)


BIN_ERRORS = {
    400: Error,
    401: Error,
    403: Error,
    404: Error,
    409: Error,
    500: Error,
    503: Error,
}
DeletedKind = Annotated[
    str,
    Field(
        json_schema_extra={"enum": ["book", "meeting", "quote", "week", "highlight"]}
    ),
]


@api.get(
    "/admin/bin",
    response={
        200: list[RecycleBinEntry],
        401: Error,
        403: Error,
        500: Error,
        503: Error,
    },
    operation_id="getRecycleBin",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_bin(request):
    return allowlist_result(list_bin, request)


@api.post(
    "/admin/bin/{type}/{id}/restore",
    response={200: list[RecycleBinEntry], **BIN_ERRORS},
    operation_id="restoreDeleted",
    openapi_extra={"security": [{"sessionCookie": [], "csrfHeader": []}]},
)
def restore_bin(request, type: DeletedKind, id: Annotated[str, Field(min_length=1)]):
    return allowlist_result(restore_deleted, request, type, id)


@api.delete(
    "/admin/bin/{type}/{id}",
    response={200: list[RecycleBinEntry], **BIN_ERRORS},
    operation_id="purgeDeleted",
    openapi_extra={"security": [{"sessionCookie": [], "csrfHeader": []}]},
)
def purge_bin(request, type: DeletedKind, id: Annotated[str, Field(min_length=1)]):
    return allowlist_result(purge_deleted, request, type, id)


@api.delete(
    "/admin/books/{bookId}",
    response={
        200: list[RecycleBinEntry],
        401: Error,
        403: Error,
        404: Error,
        500: Error,
        503: Error,
    },
    operation_id="deleteBook",
    openapi_extra={"security": [{"sessionCookie": [], "csrfHeader": []}]},
)
def delete_book(request, bookId: Annotated[str, Field(min_length=1)]):
    return allowlist_result(remove_book, request, bookId)


class BackupInfo(Schema):
    model_config = ConfigDict(extra="forbid")
    policy: Literal["pending"]
    lastBackupAt: timezone.datetime | None


class ReauthenticationError(Schema):
    model_config = ConfigDict(extra="forbid")
    code: Literal["reauthentication_required"]
    message: str


@api.get(
    "/admin/backups",
    response={200: BackupInfo, 401: Error, 403: Error, 500: Error, 503: Error},
    operation_id="getBackupInfo",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_backups(request):
    return allowlist_result(backup_info, request)


@api.post(
    "/admin/export",
    response={
        200: None,
        401: Error,
        403: Error,
        409: ReauthenticationError,
        500: Error,
        503: Error,
    },
    operation_id="exportClubData",
    openapi_extra={
        "security": [{"sessionCookie": [], "csrfHeader": []}],
        "responses": {
            "200": resolve(
                read_contract(),
                read_contract()["paths"]["/api/admin/export"]["post"]["responses"][
                    "200"
                ],
            )
        },
    },
)
def post_export(request):
    try:
        result = export_club(request)
    except Exception:
        return Status(*error_result(500))
    return result if isinstance(result, HttpResponse) else Status(*result)


class AuditTarget(Schema):
    model_config = ConfigDict(extra="forbid")
    type: Literal[
        "member",
        "curator",
        "book",
        "meeting",
        "summary",
        "highlight",
        "week",
        "quote",
        "vote",
        "club",
    ]
    id: Annotated[str, Field(min_length=1)]
    label: str


class AuditActor(Schema):
    model_config = ConfigDict(extra="forbid")
    id: Annotated[str, Field(min_length=1)]
    displayName: str


class AuditEvent(Schema):
    model_config = ConfigDict(extra="forbid")
    id: Annotated[str, Field(min_length=1)]
    action: Literal[
        "member_approved",
        "member_revoked",
        "member_restored",
        "curator_assigned",
        "curator_cleared",
        "book_status_changed",
        "summary_published",
        "summary_unpublished",
        "highlight_published",
        "highlight_unpublished",
        "soft_deleted",
        "restored",
        "purged",
        "vote_closed",
        "tie_resolved",
        "exported",
    ]
    target: AuditTarget
    actor: AuditActor
    occurredAt: timezone.datetime


@api.get(
    "/admin/audit-log",
    response={200: list[AuditEvent], 401: Error, 403: Error, 500: Error, 503: Error},
    operation_id="getAuditLog",
    openapi_extra={"security": [{"sessionCookie": []}]},
)
def get_audit_log(request):
    return allowlist_result(read_audit, request)
