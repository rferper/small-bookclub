"""Approval-vote lifecycle rows; a vote keeps its retained curator cycle."""

from django.db import models
from django.db.models import Q, Value

from books.models import Book
from users.models import CuratorAssignment


class Vote(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        OPEN = "open", "Abierta"
        CLOSED = "closed", "Cerrada"

    # The retained cycle row, never the mutable current assignment: ending or
    # replacing the curator later cannot rewrite who curated this vote.
    curator_assignment = models.ForeignKey(
        CuratorAssignment, on_delete=models.PROTECT, related_name="votes"
    )
    status = models.CharField(max_length=6, choices=Status, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    opened_at = models.DateTimeField(null=True, blank=True, default=None)
    closed_at = models.DateTimeField(null=True, blank=True, default=None)
    winning_book = models.ForeignKey(
        Book,
        null=True,
        blank=True,
        default=None,
        on_delete=models.PROTECT,
        related_name="won_votes",
    )
    tie_note = models.TextField(max_length=1000, null=True, blank=True, default=None)

    class Meta:
        constraints = [
            # At most one draft or open vote, whichever its curator.
            models.UniqueConstraint(
                Value(1),
                condition=Q(status__in=["draft", "open"]),
                name="vote_one_unclosed",
            ),
            models.CheckConstraint(
                condition=Q(status__in=["draft", "open", "closed"]),
                name="vote_known_status",
            ),
            models.CheckConstraint(
                condition=(
                    Q(status="draft", opened_at__isnull=True, closed_at__isnull=True)
                    | Q(status="open", opened_at__isnull=False, closed_at__isnull=True)
                    | Q(
                        status="closed",
                        opened_at__isnull=False,
                        closed_at__isnull=False,
                    )
                ),
                name="vote_status_dates_consistent",
            ),
            models.CheckConstraint(
                condition=Q(winning_book__isnull=True) | Q(status="closed"),
                name="vote_winner_only_closed",
            ),
        ]


class VoteCandidate(models.Model):
    vote = models.ForeignKey(Vote, on_delete=models.PROTECT, related_name="candidates")
    book = models.ForeignKey(
        Book, on_delete=models.PROTECT, related_name="vote_candidacies"
    )
    position = models.PositiveIntegerField()

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["vote", "book"], name="vote_candidate_unique_book"
            ),
        ]


class VoteApproval(models.Model):
    """One equal-weight approval by one member for one shortlisted book.

    The candidate row is unique per (vote, book), so the unique pair below is
    the spec's unique (vote, book, user) at the SQL level. Rows are written
    only while the vote is open and retained after closing as its snapshot.
    """

    candidate = models.ForeignKey(
        VoteCandidate, on_delete=models.PROTECT, related_name="approvals"
    )
    member = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="vote_approvals"
    )
    approved_at = models.DateTimeField()

    class Meta:
        ordering = ["approved_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["candidate", "member"], name="vote_approval_unique_member"
            ),
        ]
