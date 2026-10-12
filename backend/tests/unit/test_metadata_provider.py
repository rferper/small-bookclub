"""Bounded HTTP transport tests with no real network."""

from email.message import Message
from http.client import IncompleteRead
from types import SimpleNamespace
from urllib.error import HTTPError, URLError

import pytest

from books import metadata


def fake_provider(
    monkeypatch, *, data=b"{}", content_type="application/json", error=None
):
    calls = []
    headers = Message()
    headers["Content-Type"] = content_type

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self, limit):
            calls.append(limit)
            return data[:limit]

    Response.headers = headers

    def open_request(request, timeout):
        calls.append((request, timeout))
        if error:
            raise error
        return Response()

    monkeypatch.setattr(metadata, "pace", lambda: None)
    monkeypatch.setattr(
        metadata, "build_opener", lambda *args: SimpleNamespace(open=open_request)
    )
    return calls


def test_http_is_bounded_identified_and_does_not_accept_redirects(monkeypatch):
    calls = fake_provider(monkeypatch)
    assert metadata.fetch_provider(
        "https://openlibrary.org/search.json?q=fictional", 100, "application/json"
    ) == (b"{}", "application/json")
    request, timeout = calls[0]
    assert timeout == 5 and calls[1] == 101
    assert request.get_header("User-agent") == metadata.USER_AGENT
    assert (
        metadata.NoRedirect().redirect_request(
            None, None, 302, "", {}, "https://evil.test"
        )
        is None
    )


@pytest.mark.parametrize(
    "url",
    [
        "http://openlibrary.org/search.json",
        "https://evil.test",
        "https://openlibrary.org.evil.test",
        "https://openlibrary.org:9999",
        "https://user@openlibrary.org",
    ],
)
def test_provider_origin_restrictions_precede_network(monkeypatch, url):
    calls = fake_provider(monkeypatch)
    with pytest.raises(metadata.MetadataUnavailable):
        metadata.fetch_provider(url, 100, "application/json")
    assert calls == []


@pytest.mark.parametrize(
    "error",
    [
        URLError("Private"),
        TimeoutError("Private"),
        IncompleteRead(b"partial"),
        HTTPError("https://openlibrary.org", 302, "Redirect", {}, None),
    ],
)
def test_network_and_redirect_failures_are_closed(monkeypatch, error):
    fake_provider(monkeypatch, error=error)
    with pytest.raises(metadata.MetadataUnavailable):
        metadata.fetch_provider(
            "https://openlibrary.org/search.json", 100, "application/json"
        )


def test_oversized_response_is_refused(monkeypatch):
    fake_provider(monkeypatch, data=b"x" * 102)
    with pytest.raises(metadata.MetadataUnavailable):
        metadata.fetch_provider(
            "https://openlibrary.org/search.json", 100, "application/json"
        )


def test_missing_cover_has_no_placeholder_or_failure(monkeypatch):
    fake_provider(
        monkeypatch,
        error=HTTPError("https://covers.openlibrary.org", 404, "Missing", {}, None),
    )
    assert metadata.fetch_provider(
        "https://covers.openlibrary.org/b/id/123-M.jpg?default=false", 100, "image/jpeg"
    ) == (None, None)


def test_provider_requests_are_spaced_at_default_rate(monkeypatch):
    clock = [100.25]
    sleeps = []
    monkeypatch.setattr(metadata, "LAST_FETCH_AT", 100.0)
    monkeypatch.setattr(metadata.time, "monotonic", lambda: clock[0])

    def sleep(seconds):
        sleeps.append(seconds)
        clock[0] += seconds

    monkeypatch.setattr(metadata.time, "sleep", sleep)
    metadata.pace()
    assert sleeps == [0.75] and metadata.LAST_FETCH_AT == 101.0
