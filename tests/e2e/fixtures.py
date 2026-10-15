"""Seed/verify fictional native rows only inside the disposable Compose project."""

import json
import os
import sys
from datetime import date

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
if (
    os.environ.get("BOOKCLUB_ENV") != "test"
    or os.environ.get("DATABASE_PATH") != "/data/club.sqlite3"
):
    raise RuntimeError("Fixture requires the isolated Compose test database")

import django  # noqa: E402

django.setup()

from django.test import override_settings  # noqa: E402

from books.models import Book, BookCompletion  # noqa: E402
from meetings.models import Meeting, ReadingAssignment, ReadingCompletion  # noqa: E402
from reviews.models import Review  # noqa: E402
from users.demo import seed_demo  # noqa: E402
from users.models import User  # noqa: E402
from votes.models import VoteApproval, VoteCandidate  # noqa: E402

if "--verify" not in sys.argv:
    with override_settings(DEMO_MODE=True):
        assert seed_demo(), "Each browser run requires a new disposable volume"
    Book.objects.filter(status="terminado").update(
        reading_start_date=date(2025, 1, 1), reading_end_date=date(2025, 2, 1)
    )
    Book.objects.filter(status="leyendo").update(reading_start_date=date(2026, 1, 1))
    Meeting.objects.update(summary_text="E2E_SUMMARY_SENTINEL: Una biblioteca secreta.")
    Review.objects.update(text="E2E_REVIEW_SENTINEL: Una lectura compartida.")

current = Book.objects.get(status="leyendo")
finished = Book.objects.get(status="terminado")
week = ReadingAssignment.objects.filter(book=current).order_by("week_number").first()
candidate = VoteCandidate.objects.order_by("position").first()
if "--verify" in sys.argv:
    for name, discord in [
        ("desktop", "990000000000000005"),
        ("mobile", "990000000000000006"),
    ]:
        member = User.objects.get(discord_user_id=discord)
        assert member.display_name == f"Lector {name} editado"
        assert member.bio == f"Biografía ficticia {name}"
        assert ReadingCompletion.objects.get(
            member=member, assignment=week
        ).completed_at
        assert VoteApproval.objects.filter(member=member, candidate=candidate).exists()
        assert BookCompletion.objects.get(member=member, book=finished).completed_at
        review = Review.objects.get(member=member, book=finished)
        assert review.overall == 3.8 and review.text == f"Reseña propia {name}"
    print(
        "Both browser journeys persisted their own native profile/progress/vote/review."
    )
else:
    print(
        json.dumps(
            {
                "currentBook": str(current.pk),
                "finishedBook": str(finished.pk),
                "meeting": str(week.meeting_id),
                "week": str(week.pk),
                "vote": str(candidate.vote_id),
                "candidate": str(candidate.book_id),
            }
        )
    )
