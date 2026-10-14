"""Explicit fictional installation, ordinary-member session and safe seed boundary."""

from datetime import timedelta
from importlib import import_module

from django.apps import apps
from django.conf import settings
from django.contrib.auth import login, logout
from django.core.management.base import CommandError
from django.db import transaction
from django.utils import timezone

from books.models import Book, BookCompletion
from core.models import DemoInstallation, LiteraryQuote
from meetings.models import Meeting, ReadingAssignment, ReadingCompletion
from reviews.constants import CRITERIA
from reviews.models import RatingRubric, Review
from users.membership import error_result
from users.models import CuratorAssignment, User
from votes.models import Vote, VoteApproval, VoteCandidate

DEMO_DISCORD_ID = "990000000000000001"


def demo_member():
    if not settings.DEMO_MODE or not DemoInstallation.objects.filter(pk=1).exists():
        return None
    return (
        User.objects.filter(
            discord_user_id=DEMO_DISCORD_ID,
            approved=True,
            revoked_at=None,
            role=User.Role.MEMBER,
        )
        .exclude(curator_assignments__current=True)
        .first()
    )


@transaction.atomic
def sign_in_demo(request):
    if settings.DEMO_MODE:
        DemoInstallation.objects.filter(pk=1).update(id=1)
    # Only this persisted identity is eligible; never use browser role/user claims.
    member = demo_member()
    if member is None:
        return error_result(404)
    # Recheck inside the transaction before issuing a credential.
    member = User.objects.select_for_update().get(pk=member.pk)
    if not member.is_active or member.role != User.Role.MEMBER:
        return error_result(404)
    logout(request)  # Flush old OAuth state, denied state and export freshness too.
    login(request, member, backend="django.contrib.auth.backends.ModelBackend")
    return 204, None


def _unmarked_club_data_exists():
    # Fresh migrations create static rubric/quote rows; tolerate only their
    # exact untouched business values, never customized or removed seed rows.
    ignored = {DemoInstallation, LiteraryQuote, RatingRubric}
    for model in apps.get_models():
        if (
            model._meta.app_label
            in {"users", "core", "books", "meetings", "votes", "reviews"}
            and model not in ignored
            and model._meta.model_name != "requestbudget"
            and model._base_manager.exists()
        ):
            return True
    quotes = list(
        LiteraryQuote.all_objects.values_list(
            "text", "source", "author", "active", "deleted_at", "normalized_text"
        )
    )
    seeds = import_module("core.migrations.0002_seed_literary_quotes").SEEDS
    expected = {
        (
            text,
            source,
            "Miguel de Cervantes",
            True,
            None,
            " ".join(text.split()).lower(),
        )
        for text, source in seeds
    }
    if quotes and (len(quotes) != len(expected) or set(quotes) != expected):
        return True
    rubric = list(RatingRubric.objects.values_list("criterion", "star", "description"))
    expected_rubric = {
        (criterion, star, None) for criterion in CRITERIA for star in range(1, 6)
    }
    return bool(rubric) and set(rubric) != expected_rubric


@transaction.atomic
def seed_demo():
    if not settings.DEMO_MODE:
        raise CommandError("Activa DEMO_MODE explícitamente antes de crear la demo.")
    # Acquire SQLite's writer reservation before checking readiness/emptiness.
    DemoInstallation.objects.filter(pk=1).update(id=1)
    if DemoInstallation.objects.filter(pk=1).exists():
        return False
    if _unmarked_club_data_exists():
        raise CommandError(
            "La base de datos contiene datos del club sin marca de demo."
        )
    now = timezone.now()
    members = [
        User.objects.create_user(
            str(int(DEMO_DISCORD_ID) + index),
            display_name=name,
            approved=True,
            bio="Perfil ficticio de la demostración.",
        )
        for index, name in enumerate(
            [
                "Lector demo",
                "Alba ficticia",
                "Bruno ficticio",
                "Celia ficticia",
                "Dario ficticio",
                "Eva ficticia",
            ]
        )
    ]
    current = Book.objects.create(
        title="El faro de papel (ficticio)",
        authors=["Autora ficticia"],
        description="Una aventura inventada para explorar el club.",
        status="leyendo",
        page_count=200,
    )
    finished = Book.objects.create(
        title="El mapa de las nubes (ficticio)",
        authors=["Autor ficticio"],
        status="terminado",
        page_count=120,
    )
    for index in range(2):
        meeting = Meeting.objects.create(
            book=current,
            starts_at=now + timedelta(days=(index * 7 - 7)),
            summary_text="Resumen ficticio: el faro ilumina una biblioteca secreta.",
            summary_published=True,
        )
        week = ReadingAssignment.objects.create(
            book=current,
            meeting=meeting,
            week_number=index + 1,
            percent_start=index * 50,
            percent_end=(index + 1) * 50,
            page_start=index * 100 + 1,
            page_end=(index + 1) * 100,
        )
        ReadingCompletion.objects.create(
            assignment=week, member=members[1], completed_at=now
        )
    for member in members[1:4]:
        BookCompletion.objects.create(book=finished, member=member, completed_at=now)
        Review.objects.create(
            book=finished,
            member=member,
            text="Reseña ficticia de una lectura compartida.",
            **dict.fromkeys(CRITERIA, 4),
        )
    curator = CuratorAssignment.objects.create(member=members[1])
    vote = Vote.objects.create(curator_assignment=curator, status="open", opened_at=now)
    for index, title in enumerate(
        ["La ciudad de los relojes (ficticio)", "Cartas del bosque (ficticio)"]
    ):
        book = Book.objects.create(title=title, authors=["Autoría ficticia"])
        candidate = VoteCandidate.objects.create(
            vote=vote, book=book, position=index + 1
        )
        VoteApproval.objects.create(
            candidate=candidate, member=members[index + 1], approved_at=now
        )
    DemoInstallation.objects.create(pk=1)
    return True
