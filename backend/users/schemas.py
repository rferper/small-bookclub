"""Independent closed authentication wire schemas."""

from datetime import date, datetime
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


class BookSummary(ClosedSchema):
    id: str = Field(min_length=1)
    title: str
    authors: list[str]
    coverUrl: str | None


class OriginVote(ClosedSchema):
    id: str = Field(min_length=1)
    label: str


class AdminBook(ClosedSchema):
    id: str = Field(min_length=1)
    title: str = Field(
        min_length=1,
        max_length=200,
        json_schema_extra={"x-trimmedMinLength": 1, "x-trimmedMaxLength": 200},
    )
    authors: list[
        Annotated[
            str,
            Field(
                min_length=1,
                max_length=120,
                json_schema_extra={"x-trimmedMinLength": 1, "x-trimmedMaxLength": 120},
            ),
        ]
    ] = Field(max_length=20)
    coverUrl: str | None
    status: Literal["propuesto", "elegido", "leyendo", "terminado", "archivado"]
    readingStartDate: date | None
    readingEndDate: date | None
    datesApproximate: bool
    plannedStartDate: date | None
    plannedEndDate: date | None
    description: (
        Annotated[
            str, Field(max_length=5000, json_schema_extra={"x-trimmedMaxLength": 5000})
        ]
        | None
    )
    publicationDate: (
        Annotated[
            str, Field(max_length=100, json_schema_extra={"x-trimmedMaxLength": 100})
        ]
        | None
    )
    publisher: (
        Annotated[
            str, Field(max_length=200, json_schema_extra={"x-trimmedMaxLength": 200})
        ]
        | None
    )
    isbn: (
        Annotated[
            str, Field(max_length=100, json_schema_extra={"x-trimmedMaxLength": 100})
        ]
        | None
    )
    pageCount: Annotated[int, Field(ge=1, le=9007199254740991)] | None
    originVote: OriginVote | None


class MyProfile(ClosedSchema):
    member: MemberSummary
    bio: str | None
    favouriteQuote: str | None
    favouriteBooks: list[BookSummary] = Field(max_length=5)
    favouriteOptions: list[BookSummary]


class MemberDirectoryEntry(ClosedSchema):
    member: MemberSummary
    isMe: bool
    completedCurrentWeek: bool | None


class MemberDirectory(ClosedSchema):
    currentWeekNumber: int | None = Field(ge=1)
    members: list[MemberDirectoryEntry]


class MemberWeekStatus(ClosedSchema):
    weekNumber: int = Field(ge=1)
    completed: bool


class MemberProfile(ClosedSchema):
    member: MemberSummary
    bio: str | None
    favouriteQuote: str | None
    favouriteBooks: list[BookSummary] = Field(max_length=5)
    isMe: bool
    currentWeek: MemberWeekStatus | None


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
