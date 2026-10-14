"""Production TypeScript adapter → real HTTP → Django → disposable SQLite."""

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest
from django.test import Client
from django.utils import timezone
from jsonschema import Draft202012Validator, FormatChecker

from books.models import Book, BookCompletion
from config.contract import read_contract, resolve
from meetings.models import Meeting, ReadingAssignment, ReadingCompletion
from reviews.constants import CRITERIA
from reviews.models import Review
from users.models import CuratorAssignment, User
from votes.models import Vote, VoteApproval, VoteCandidate

pytestmark = [pytest.mark.integration, pytest.mark.django_db(transaction=True)]
FRONTEND = Path(__file__).resolve().parents[3] / "frontend"


@pytest.fixture
def bridge_server(settings, request):
    # Django's test static handler requires a URL even without staticfiles installed.
    settings.STATIC_URL = "/static/"
    return request.getfixturevalue("live_server")


def test_real_frontend_adapter_session_reading_vote_and_spoiler_journey(bridge_server):
    assert shutil.which("node"), "Install Node 24 and run npm ci in frontend first"
    member = User.objects.create_user(
        "990000000000000001", approved=True, display_name="Lector ficticio"
    )
    other = User.objects.create_user(
        "990000000000000002", approved=True, display_name="Otro lector ficticio"
    )
    book = Book.objects.create(title="Libro ficticio integrado", status="terminado")
    meeting = Meeting.objects.create(
        book=book,
        starts_at=timezone.now(),
        summary_text="SUMMARY_SENTINEL",
        summary_published=True,
        record_safe=True,
    )
    week = ReadingAssignment.objects.create(
        book=book,
        meeting=meeting,
        week_number=1,
        percent_start=0,
        percent_end=100,
        page_start=1,
        page_end=100,
    )
    BookCompletion.objects.create(book=book, member=other, completed_at=timezone.now())
    Review.objects.create(
        book=book,
        member=other,
        text="FOREIGN_REVIEW_SENTINEL",
        **dict.fromkeys(CRITERIA, 4),
    )
    assignment = CuratorAssignment.objects.create(member=other)
    candidate = Book.objects.create(title="Candidato ficticio")
    vote = Vote.objects.create(
        curator_assignment=assignment, status="open", opened_at=timezone.now()
    )
    shortlist = VoteCandidate.objects.create(vote=vote, book=candidate, position=1)
    browser = Client()
    browser.force_login(member)
    result = subprocess.run(
        [shutil.which("node"), "scripts/integration-client.mjs"],
        cwd=FRONTEND,
        input=json.dumps(
            {
                "origin": bridge_server.url,
                "session": browser.cookies["sessionid"].value,
                "book": str(book.pk),
                "meeting": str(meeting.pk),
                "week": str(week.pk),
                "vote": str(vote.pk),
                "candidate": str(candidate.pk),
            }
        ),
        text=True,
        encoding="utf-8",
        capture_output=True,
        timeout=90,
    )
    assert result.returncode == 0, result.stderr
    trace = json.loads(result.stdout)
    document = read_contract()
    for item in trace:
        matches = [
            path
            for path in document["paths"]
            if re.fullmatch(re.sub(r"\{[^}]+\}", "[^/]+", path), item["path"])
        ]
        assert len(matches) == 1, item["path"]
        response = resolve(
            document,
            document["paths"][matches[0]][item["method"]]["responses"][
                str(item["status"])
            ],
        )
        if item["status"] == 204:
            assert item["body"] is None
        else:
            Draft202012Validator(
                response["content"]["application/json"]["schema"],
                format_checker=FormatChecker(),
            ).validate(item["body"])
    member.refresh_from_db()
    assert member.display_name == "Lector ficticio actualizado"
    assert ReadingCompletion.objects.get(assignment=week, member=member).completed_at
    assert VoteApproval.objects.filter(candidate=shortlist, member=member).exists()
    assert BookCompletion.objects.get(book=book, member=member).completed_at
    assert Review.objects.get(book=book, member=member).overall == 3.8
    assert Review.objects.filter(book=book).count() == 2
