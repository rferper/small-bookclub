"""Vote and shortlist services.

Management authority comes from the central policy (``nominate_books``): the
*current* curator assignment or an admin, always decided on persisted rows and
before any vote or book lookup. A vote keeps the retained curator cycle it was
created under, so changing the current curator never rewrites its curator.
Approvals are public: every approved member sees each candidate's voters and
totals, and each member adds or withdraws only their own approval while the vote
is open. Closure freezes approvals; only an admin records a pending tie winner.
"""

import json

from django.core.exceptions import SuspiciousOperation
from django.db import IntegrityError, transaction
from django.db.models import Count, Prefetch
from django.utils import timezone

from books.home import book_summary
from books.models import Book
from users.access import (
    can_manage_vote,
    is_admin,
    permission_refusal,
    require_permission,
)
from users.directory import member_summary
from users.membership import error_result, native_member_id
from users.models import CuratorAssignment, User
from users.profile import OWNER_KEYS

from .models import Vote, VoteApproval, VoteCandidate


def current_assignment(lock=False):
    rows = CuratorAssignment.objects.select_related("member")
    if lock:
        rows = rows.select_for_update()
    return rows.filter(current=True).first()


def curator_context(request, *args, **kwargs):
    assignment = current_assignment(lock=True)
    return {"curator_id": assignment.member_id if assignment else None}


def manage_votes(handler):
    """Mutating guard: 401, then current curator/admin 403, before any lookup."""
    guarded = require_permission("nominate_books", context=curator_context)(handler)
    return transaction.atomic(guarded)


def lookup_vote(vote_id, *, lock=False):
    key = native_member_id(vote_id)
    if not key:
        return None
    rows = Vote.objects.select_related("curator_assignment__member")
    if lock:
        rows = rows.select_for_update()
    return rows.filter(pk=key).first()


def is_visible(vote):
    """A vote naming a removed catalogue book is hidden whole, never partially."""
    return not vote.candidates.filter(book__deleted_at__isnull=False).exists()


def project_book(book):
    return {
        "id": str(book.pk),
        "title": book.title,
        "authors": book.authors,
        "coverUrl": book.cover_path or None,
        "publicationDate": book.publication_date,
        "pageCount": book.page_count,
    }


def candidates(vote):
    approvals = VoteApproval.objects.select_related("member")
    return vote.candidates.select_related("book").prefetch_related(
        Prefetch("approvals", queryset=approvals)
    )


def project_candidate(row, actor):
    voters = [approval.member for approval in row.approvals.all()]
    return {
        "book": project_book(row.book),
        "approvals": [member_summary(voter) for voter in voters],
        "approvedByMe": any(voter.pk == actor.pk for voter in voters),
    }


def project_vote(vote, actor):
    assignment = current_assignment()
    current_curator_id = assignment.member_id if assignment else None
    return {
        "id": str(vote.pk),
        "status": vote.status,
        "curator": member_summary(vote.curator_assignment.member),
        "openedAt": vote.opened_at,
        "closedAt": vote.closed_at,
        "candidates": [project_candidate(row, actor) for row in candidates(vote)],
        "outcome": project_outcome(vote),
        "canManage": vote.status != Vote.Status.CLOSED
        and can_manage_vote(actor, current_curator_id),
        "canRecordTieWinner": vote.status == Vote.Status.CLOSED
        and vote.winning_book_id is None
        and len(leading_book_ids(vote)) >= 2
        and is_admin(actor),
        "curatedByMe": actor.pk == vote.curator_assignment.member_id,
    }


def leaders(counts):
    """Return all maximum-count IDs in shortlist order, including zero votes."""
    maximum = max((count for _, count in counts), default=0)
    return [key for key, count in counts if count == maximum]


def leading_book_ids(vote):
    rows = vote.candidates.annotate(total=Count("approvals"))
    return leaders([(str(row.book_id), row.total) for row in rows])


def project_outcome(vote):
    if vote.status != Vote.Status.CLOSED:
        return None
    if vote.winning_book_id:
        return {
            "status": "winner",
            "winner": book_summary(vote.winning_book),
            "tieNote": vote.tie_note,
        }
    return {"status": "tiePending", "tiedBookIds": leading_book_ids(vote)}


@require_permission("view_club")
def list_votes(request):
    actor = request.user
    assignment = current_assignment()
    pending = (
        Vote.objects.select_related("curator_assignment__member")
        .exclude(status=Vote.Status.CLOSED)
        .first()
    )
    curator_id = assignment.member_id if assignment else None
    return 200, {
        "curator": member_summary(assignment.member) if assignment else None,
        "current": project_vote(pending, actor)
        if pending and is_visible(pending)
        else None,
        "history": [
            project_history(vote)
            for vote in Vote.objects.filter(status=Vote.Status.CLOSED)
            .select_related("curator_assignment__member", "winning_book")
            .order_by("-closed_at", "-pk")
            if is_visible(vote)
        ],
        "canCreateVote": assignment is not None
        and pending is None
        and can_manage_vote(actor, curator_id),
    }


@require_permission("view_club")
def read_vote(request, vote_id):
    vote = lookup_vote(vote_id)
    if vote is None or not is_visible(vote):
        return error_result(404)
    return 200, project_vote(vote, request.user)


def project_history(vote):
    return {
        "id": str(vote.pk),
        "curator": member_summary(vote.curator_assignment.member),
        "openedAt": vote.opened_at,
        "closedAt": vote.closed_at,
        "outcome": project_outcome(vote),
        "candidateCount": vote.candidates.count(),
    }


def record_book_origin(vote):
    """The first recorded win supplies a stable server-owned origin link."""
    if vote.winning_book_id:
        Book.objects.filter(pk=vote.winning_book_id, origin_vote__isnull=True).update(
            origin_vote=vote
        )


def request_object(request):
    try:
        if request.content_type == "application/json" and len(request.body) <= 65536:
            value = json.loads(request.body)
            return value if isinstance(value, dict) else None
    except (ValueError, UnicodeDecodeError, SuspiciousOperation):
        pass
    return None


def managed_vote(vote_id):
    """Lookup after the permission check; a hidden vote refuses actions with 409."""
    vote = lookup_vote(vote_id, lock=True)
    if vote is None:
        return None, error_result(404)
    if not is_visible(vote):
        return None, error_result(409)
    return vote, None


def renumber(vote):
    for position, row in enumerate(vote.candidates.all(), start=1):
        if row.position != position:
            VoteCandidate.objects.filter(pk=row.pk).update(position=position)


@manage_votes
def create_vote(request):
    assignment = current_assignment(lock=True)
    if assignment is None or Vote.objects.exclude(status=Vote.Status.CLOSED).exists():
        return error_result(409)
    try:
        with transaction.atomic():
            # Owned by the current curator even when an admin creates it.
            vote = Vote.objects.create(curator_assignment=assignment)
    except IntegrityError:
        return error_result(409)
    return 201, project_vote(lookup_vote(str(vote.pk)), request.user)


@manage_votes
def add_candidate(request, vote_id):
    vote, failure = managed_vote(vote_id)
    if failure:
        return failure
    body = request_object(request)
    if (
        body is None
        or set(body) != {"bookId"}
        or not isinstance(body["bookId"], str)
        or not body["bookId"]
    ):
        return error_result(400)
    key = native_member_id(body["bookId"])
    book = Book.objects.filter(pk=key).first() if key else None
    if book is None:
        return error_result(404)
    if (
        vote.status == Vote.Status.CLOSED
        or book.status != Book.Status.PROPOSED
        or vote.candidates.filter(book=book).exists()
    ):
        return error_result(409)
    last = vote.candidates.order_by("-position").first()
    VoteCandidate.objects.create(
        vote=vote, book=book, position=(last.position if last else 0) + 1
    )
    return 200, project_vote(vote, request.user)


@manage_votes
def remove_candidate(request, vote_id, book_id):
    vote, failure = managed_vote(vote_id)
    if failure:
        return failure
    key = native_member_id(book_id)
    row = vote.candidates.filter(book_id=key).first() if key else None
    if row is None:
        return error_result(404)
    if vote.status == Vote.Status.CLOSED:
        return error_result(409)
    if vote.status == Vote.Status.OPEN and vote.candidates.count() <= 2:
        return error_result(409)
    # Approvals go with their candidate in the same transaction, never by cascade.
    row.approvals.all().delete()
    row.delete()
    renumber(vote)
    return 200, project_vote(vote, request.user)


@manage_votes
def reorder_candidates(request, vote_id):
    vote, failure = managed_vote(vote_id)
    if failure:
        return failure
    body = request_object(request)
    ids = body.get("bookIds") if body is not None and set(body) == {"bookIds"} else None
    if not isinstance(ids, list) or any(not isinstance(item, str) for item in ids):
        return error_result(400)
    keys = [native_member_id(item) for item in ids]
    known = {book.pk for book in Book.objects.filter(pk__in=[k for k in keys if k])}
    if any(key is None or key not in known for key in keys):
        return error_result(404)
    current = list(vote.candidates.values_list("book_id", flat=True))
    if vote.status == Vote.Status.CLOSED or sorted(keys) != sorted(current):
        return error_result(409)
    for position, key in enumerate(keys, start=1):
        VoteCandidate.objects.filter(vote=vote, book_id=key).update(position=position)
    return 200, project_vote(vote, request.user)


@manage_votes
def open_vote(request, vote_id):
    vote, failure = managed_vote(vote_id)
    if failure:
        return failure
    if vote.status != Vote.Status.DRAFT or vote.candidates.count() < 2:
        return error_result(409)
    vote.status = Vote.Status.OPEN
    vote.opened_at = timezone.now()
    vote.save(update_fields=["status", "opened_at"])
    return 200, project_vote(vote, request.user)


def own_vote_context(request, *args, **kwargs):
    return {"owner_id": request.user.pk}


@transaction.atomic
@require_permission("cast_own_vote", context=own_vote_context)
def set_approval(request, vote_id, book_id):
    """Add or withdraw the session member's own approval; idempotent."""
    # Lock the member row so a concurrent revocation cannot interleave.
    actor = User.objects.select_for_update().filter(pk=request.user.pk).first()
    refusal = permission_refusal(actor, "cast_own_vote", owner_id=request.user.pk)
    if refusal:
        return error_result(refusal)
    request.user = actor
    body = request_object(request)
    # Identity comes only from the session; smuggled owner keys are forbidden.
    if body is not None and any(key.casefold() in OWNER_KEYS for key in body):
        return error_result(403)
    vote = lookup_vote(vote_id, lock=True)
    key = native_member_id(book_id)
    row = vote.candidates.filter(book_id=key).first() if vote and key else None
    if row is None:
        return error_result(404)
    if not is_visible(vote) or vote.status != Vote.Status.OPEN:
        return error_result(409)
    if body is None or set(body) != {"approved"} or type(body["approved"]) is not bool:
        return error_result(400)
    if body["approved"]:
        VoteApproval.objects.get_or_create(
            candidate=row, member=actor, defaults={"approved_at": timezone.now()}
        )
    else:
        VoteApproval.objects.filter(candidate=row, member=actor).delete()
    return 200, project_vote(vote, actor)


def locked_actor(request, action, **facts):
    """Refresh authority under lock before committing a lifecycle mutation."""
    actor = User.objects.select_for_update().filter(pk=request.user.pk).first()
    refusal = permission_refusal(actor, action, **facts)
    if refusal:
        return error_result(refusal)
    request.user = actor
    return None


@transaction.atomic
@require_permission("close_vote", context=curator_context)
def close_vote(request, vote_id):
    assignment = current_assignment(lock=True)
    refusal = locked_actor(
        request, "close_vote", curator_id=assignment.member_id if assignment else None
    )
    if refusal:
        return refusal
    vote, failure = managed_vote(vote_id)
    if failure:
        return failure
    if vote.status != Vote.Status.OPEN or vote.candidates.count() < 2:
        return error_result(409)
    top = leading_book_ids(vote)
    vote.status = Vote.Status.CLOSED
    vote.closed_at = timezone.now()
    vote.winning_book_id = int(top[0]) if len(top) == 1 else None
    vote.save(update_fields=["status", "closed_at", "winning_book"])
    record_book_origin(vote)
    return 200, project_vote(vote, request.user)


@transaction.atomic
@require_permission("record_tie_winner")
def record_tie_winner(request, vote_id):
    refusal = locked_actor(request, "record_tie_winner")
    if refusal:
        return refusal
    vote, failure = managed_vote(vote_id)
    if failure:
        return failure
    body = request_object(request)
    if (
        body is None
        or set(body) != {"bookId", "note"}
        or not isinstance(body["bookId"], str)
        or not body["bookId"]
        or not isinstance(body["note"], str)
    ):
        return error_result(400)
    key = native_member_id(body["bookId"])
    book = Book.objects.filter(pk=key).first() if key else None
    if book is None:
        return error_result(404)
    top = leading_book_ids(vote)
    if (
        vote.status != Vote.Status.CLOSED
        or vote.winning_book_id is not None
        or len(top) < 2
        or str(book.pk) not in top
    ):
        return error_result(409)
    note = body["note"].strip()
    if len(note) > 1000:
        return error_result(400)
    vote.winning_book = book
    vote.tie_note = note or None
    vote.save(update_fields=["winning_book", "tie_note"])
    record_book_origin(vote)
    return 200, project_vote(vote, request.user)
