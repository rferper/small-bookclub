"""Independent closed authentication wire schemas."""

from datetime import datetime
from typing import Annotated, Literal

from ninja import Schema
from pydantic import ConfigDict, Field


class ClosedSchema(Schema):
    model_config = ConfigDict(extra="forbid")


class CurrentUser(ClosedSchema):
    id: str = Field(min_length=1)
    displayName: str
    role: Literal["admin", "member"]
    avatarUrl: str | None


class MemberSummary(ClosedSchema):
    id: str = Field(min_length=1)
    displayName: str
    avatarUrl: str | None


class AdminMember(ClosedSchema):
    member: MemberSummary
    discordId: str = Field(pattern=r"^[0-9]{17,20}$")
    role: Literal["member", "admin"]
    status: Literal["active", "revoked"]
    addedAt: datetime
    revokedAt: datetime | None
    isMe: bool
    isCurator: bool


class AdminMembers(ClosedSchema):
    members: list[AdminMember]
    curator: MemberSummary | None


class NewMember(ClosedSchema):
    discordId: str = Field(pattern=r"^[0-9]{17,20}$")
    displayName: str = Field(
        min_length=1,
        json_schema_extra={"x-trimmedMinLength": 1, "x-trimmedMaxLength": 40},
    )


class SessionAnonymous(ClosedSchema):
    status: Literal["anonymous"]
    demoSignInAvailable: bool


class SessionDenied(ClosedSchema):
    status: Literal["denied"]
    demoSignInAvailable: bool


class SessionSignedIn(ClosedSchema):
    status: Literal["signedIn"]
    user: CurrentUser


Session = Annotated[
    SessionAnonymous | SessionDenied | SessionSignedIn, Field(discriminator="status")
]


class Error(ClosedSchema):
    code: Literal[
        "invalid_input",
        "unauthenticated",
        "forbidden",
        "not_found",
        "conflict",
        "reauthentication_required",
        "internal_error",
        "service_unavailable",
    ]
    message: str = Field(min_length=1)


REDIRECT_RESPONSE = {
    "description": "Provider navigation or fixed same-origin destination.",
    "headers": {"Location": {"required": True, "schema": {"type": "string"}}},
}


def query_parameter(name, schema):
    return {"name": name, "in": "query", "required": False, "schema": schema}
