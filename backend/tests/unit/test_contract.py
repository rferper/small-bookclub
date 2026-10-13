import json
from copy import deepcopy

import pytest

from config.api import api
from config.contract import (
    check_schema,
    implemented_operations,
    normalize_schema,
    read_contract,
)


def documents():
    return deepcopy(read_contract()), json.loads(json.dumps(api.get_openapi_schema()))


def test_every_real_registered_operation_matches_contract_without_future_stubs():
    contract, generated = documents()
    assert len(contract["paths"]) > len(generated["paths"])
    assert check_schema(contract, generated, implemented_operations(api)) == [
        "GET /api/health (getHealth)",
        "GET /api/session (getSession)",
        "GET /api/auth/discord/start (startSignIn)",
        "GET /api/auth/discord/callback (discordCallback)",
        "POST /api/auth/logout (signOut)",
        "POST /api/admin/members/{memberId}/revoke (revokeMember)",
        "GET /api/admin/members (getAdminMembers)",
        "POST /api/admin/members (addMember)",
        "POST /api/admin/members/{memberId}/restore (restoreMember)",
        "GET /api/me/profile (getMyProfile)",
        "PUT /api/me/profile (updateMyProfile)",
        "GET /api/media/avatars/{avatarId} (getAvatar)",
        "GET /api/members (listMembers)",
        "GET /api/members/{memberId} (getMemberProfile)",
        "GET /api/admin/books (listAdminBooks)",
        "POST /api/admin/books (createBook)",
        "GET /api/admin/books/{bookId} (getAdminBook)",
        "PUT /api/admin/books/{bookId} (updateBook)",
        "GET /api/media/covers/{coverId} (getCover)",
        "GET /api/admin/book-metadata (searchBookMetadata)",
        "GET /api/books (listBooks)",
        "GET /api/books/{bookId} (getBook)",
        "GET /api/admin/meetings (listAdminMeetings)",
        "POST /api/admin/meetings (createMeeting)",
        "GET /api/admin/meetings/{meetingId} (getAdminMeeting)",
        "PUT /api/admin/meetings/{meetingId} (updateMeeting)",
        "DELETE /api/admin/meetings/{meetingId} (deleteMeeting)",
        "PUT /api/admin/meetings/{meetingId}/cancelled (setMeetingCancelled)",
        "GET /api/admin/deletion-preview/{type}/{id} (getDeletionPreview)",
        "GET /api/admin/books/{bookId}/reading-plan (getAdminReadingPlan)",
        "POST /api/admin/books/{bookId}/reading-plan/weeks (createReadingWeek)",
        "PUT /api/admin/books/{bookId}/reading-plan/weeks/order (reorderReadingWeeks)",
        "PUT /api/admin/books/{bookId}/reading-plan/weeks/{weekId} (updateReadingWeek)",
        "DELETE /api/admin/books/{bookId}/reading-plan/weeks/{weekId} "
        "(removeReadingWeek)",
        "PUT /api/weeks/{weekId}/completion (setWeekCompleted)",
        "GET /api/books/{bookId}/ratings (getBookRatings)",
        "PUT /api/books/{bookId}/finished (setBookFinished)",
        "GET /api/home (getHome)",
        "GET /api/meetings (listMeetings)",
        "GET /api/meetings/{meetingId} (getMeeting)",
        "PUT /api/admin/meetings/{meetingId}/attendance (setMeetingAttendance)",
        "GET /api/admin/meetings/{meetingId}/record (getAdminMeetingRecord)",
        "PUT /api/admin/meetings/{meetingId}/record/summary (saveMeetingSummary)",
        "POST /api/admin/meetings/{meetingId}/record/highlights "
        "(createMeetingHighlight)",
        "PUT /api/admin/meetings/{meetingId}/record/highlights/order "
        "(reorderMeetingHighlights)",
        "PUT /api/admin/meetings/{meetingId}/record/highlights/{highlightId} "
        "(updateMeetingHighlight)",
        "DELETE /api/admin/meetings/{meetingId}/record/highlights/{highlightId} "
        "(removeMeetingHighlight)",
        "PUT /api/admin/meetings/{meetingId}/record/safe (setMeetingRecordSafe)",
        "PUT /api/admin/curator (setCurator)",
        "GET /api/votes (getVotes)",
        "POST /api/votes (createVote)",
        "GET /api/votes/{voteId} (getVote)",
        "POST /api/votes/{voteId}/candidates (addCandidate)",
        "PUT /api/votes/{voteId}/candidates/order (reorderCandidates)",
        "DELETE /api/votes/{voteId}/candidates/{bookId} (removeCandidate)",
        "POST /api/votes/{voteId}/open (openVote)",
    ]


@pytest.mark.parametrize("side", ["contract", "generated"])
@pytest.mark.parametrize(
    "mutation",
    [
        "field",
        "type",
        "required",
        "closedness",
        "value",
        "status",
        "media",
        "security",
        "operationId",
        "missing",
    ],
)
def test_health_drift_is_rejected_in_either_independent_document(side, mutation):
    contract, generated = documents()
    target = contract if side == "contract" else generated
    operation = target["paths"]["/api/health"]["get"]
    schema = (
        operation["responses"]["200"]["content"]["application/json"]["schema"]
        if side == "contract"
        else target["components"]["schemas"]["Health"]
    )
    if mutation == "field":
        schema["properties"]["environment"] = {"type": "string"}
    elif mutation == "type":
        schema["properties"]["status"]["type"] = "integer"
    elif mutation == "required":
        schema["required"] = []
    elif mutation == "closedness":
        schema["additionalProperties"] = True
    elif mutation == "value":
        schema["properties"]["status"]["const"] = "ready"
    elif mutation == "status":
        operation["responses"]["201"] = operation["responses"].pop("200")
    elif mutation == "media":
        content = operation["responses"]["200"]["content"]
        content["text/plain"] = content.pop("application/json")
    elif mutation == "security":
        operation["security"] = [{"sessionCookie": []}]
    elif mutation == "operationId":
        operation["operationId"] = "wrongHealth"
    elif mutation == "missing":
        target["paths"].pop("/api/health")
    with pytest.raises(ValueError):
        check_schema(contract, generated, implemented_operations(api))


def test_undocumented_generated_operation_is_rejected():
    contract, generated = documents()
    generated["paths"]["/api/fictional"] = deepcopy(generated["paths"]["/api/health"])
    registered = implemented_operations(api) | {("/api/fictional", "get")}
    with pytest.raises(ValueError, match="Undocumented"):
        check_schema(contract, generated, registered)


def test_missing_generated_registered_operation_is_rejected():
    contract, generated = documents()
    with pytest.raises(ValueError, match="registered implemented"):
        check_schema(
            contract,
            generated,
            implemented_operations(api) | {("/api/fictional", "post")},
        )


def test_future_registered_operation_enters_comparison_with_request_constraints():
    contract, generated = documents()
    operation = deepcopy(generated["paths"]["/api/health"]["get"])
    operation["operationId"] = "fictionalCreate"
    operation["requestBody"] = {
        "required": True,
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["title"],
                    "properties": {"title": {"type": "string", "minLength": 1}},
                }
            }
        },
    }
    generated["paths"]["/api/fictional"] = {"post": deepcopy(operation)}
    # The contract needs its own schema, without references into the generated doc.
    operation["responses"]["200"]["content"]["application/json"]["schema"] = deepcopy(
        generated["components"]["schemas"]["Health"]
    )
    contract["paths"]["/api/fictional"] = {"post": operation}
    registered = implemented_operations(api) | {("/api/fictional", "post")}
    assert len(check_schema(contract, generated, registered)) == len(registered)
    generated["paths"]["/api/fictional"]["post"]["requestBody"]["required"] = False
    with pytest.raises(ValueError, match="Schema drift"):
        check_schema(contract, generated, registered)


def test_schema_annotations_can_be_omitted_without_dropping_property_names_or_values():
    schema = {
        "title": "Label",
        "description": "Annotation",
        "type": "object",
        "properties": {
            "title": {"type": "string", "minLength": 1},
            "description": {"const": {"title": "data"}},
        },
    }
    normalized = normalize_schema(schema)
    assert "title" not in normalized
    assert normalized["properties"]["title"]["minLength"] == 1
    assert normalized["properties"]["description"]["const"] == {"title": "data"}


def test_arbitrary_constraint_keyword_data_preserves_annotation_like_names():
    schema = {
        "type": "object",
        "dependentRequired": {"title": ["description"]},
        "x-rule": {"title": "behaviour"},
        "allOf": [{"description": "note", "minProperties": 1}],
    }
    normalized = normalize_schema(schema)
    assert normalized["dependentRequired"] == {"title": ["description"]}
    assert normalized["x-rule"] == {"title": "behaviour"}
    assert normalized["allOf"] == [{"minProperties": 1}]
