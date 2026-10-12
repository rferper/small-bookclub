"""Bounded Open Library lookup and admin-session cover import receipts."""

import json
import math
import re
import threading
import time
import uuid
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from core.images import MAX_IMAGE_BYTES, encode_image
from users.access import require_permission
from users.authentication import current_identity
from users.membership import error_result

SESSION_KEY = "club_book_metadata"
USER_AGENT = "SmallBookclub/1.2 (+https://github.com/rferper/small-bookclub)"
RESULT_TTL = 900
SEARCH_CACHE_TTL = 300
FETCH_LOCK = threading.Lock()
LAST_FETCH_AT = 0.0


class MetadataUnavailable(ValueError):
    """Provider failure, with no upstream body exposed to the club."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def pace():
    global LAST_FETCH_AT
    with FETCH_LOCK:
        delay = 1 - (time.monotonic() - LAST_FETCH_AT)
        if delay > 0:
            time.sleep(delay)
        LAST_FETCH_AT = time.monotonic()


def fetch_provider(url, limit, accept):
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.netloc not in {
        "openlibrary.org",
        "covers.openlibrary.org",
    }:
        raise MetadataUnavailable("Invalid provider origin")
    pace()
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    try:
        with build_opener(NoRedirect()).open(request, timeout=5) as response:
            data = response.read(limit + 1)
            if len(data) > limit:
                raise MetadataUnavailable("Provider response too large")
            return data, response.headers.get_content_type()
    except HTTPError as error:
        if parsed.hostname == "covers.openlibrary.org" and error.code == 404:
            return None, None
        raise MetadataUnavailable("Provider refused request") from None
    except (URLError, OSError, TimeoutError) as error:
        raise MetadataUnavailable("Provider unavailable") from error


def safe_text(value, limit):
    if not isinstance(value, str) or "\x00" in value:
        return None
    return value.strip()[:limit] or None


def map_result(document):
    if not isinstance(document, dict):
        return None
    title = safe_text(document.get("title"), 200)
    key = document.get("key")
    if (
        not title
        or not isinstance(key, str)
        or not re.fullmatch(r"(?:/works/)?OL[0-9]+W", key)
    ):
        return None
    authors = document.get("author_name", [])
    authors = (
        [text for item in authors[:20] if (text := safe_text(item, 120))]
        if isinstance(authors, list)
        else []
    )
    year = document.get("first_publish_year")
    cover_id = document.get("cover_i")
    cover_id = (
        cover_id if type(cover_id) is int and 0 < cover_id <= 9007199254740991 else None
    )
    return {
        "result": {
            "id": uuid.uuid4().hex,
            "title": title,
            "authors": authors,
            "description": None,
            "publicationDate": str(year)
            if type(year) is int and 1 <= year <= 9999
            else None,
            "publisher": None,
            "isbn": None,
            "pageCount": None,
            "coverUrl": cover_url(cover_id) if cover_id else None,
        },
        "work": key if key.startswith("/works/") else "/works/" + key,
        "coverId": cover_id,
    }


def cover_url(cover_id):
    return f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg?default=false"


def valid_receipts(request):
    record = request.session.get(SESSION_KEY)
    if not isinstance(record, dict) or record.get("owner") != str(request.user.pk):
        return None
    stamp = record.get("at")
    if type(stamp) not in {float, int} or not math.isfinite(stamp):
        return None
    age = timezone.now().timestamp() - stamp
    return record if 0 <= age < RESULT_TTL else None


@require_permission("manage_catalogue")
def search_metadata(request):
    queries = request.GET.getlist("query")
    if (
        len(queries) != 1
        or not 1 <= len(queries[0].strip()) <= 200
        or "\x00" in queries[0]
    ):
        return error_result(400)
    query = queries[0].strip()
    cached = valid_receipts(request)
    if (
        cached
        and cached.get("query") == query
        and timezone.now().timestamp() - cached["at"] < SEARCH_CACHE_TTL
    ):
        return 200, [row["result"] for row in cached["rows"]]
    url = "https://openlibrary.org/search.json?" + urlencode(
        {
            "q": query,
            "fields": "key,title,author_name,first_publish_year,cover_i",
            "limit": 8,
        }
    )
    try:
        data, mime = fetch_provider(url, 1024 * 1024, "application/json")
        if mime != "application/json":
            raise MetadataUnavailable("Invalid provider content type")
        payload = json.loads(data)
        if not isinstance(payload, dict) or not isinstance(payload.get("docs"), list):
            raise MetadataUnavailable("Invalid provider response")
    except (MetadataUnavailable, ValueError, UnicodeDecodeError):
        return error_result(503)
    # Refresh membership after external work before publishing receipt authority.
    identity = current_identity(request)
    from users.access import approved_admin_refusal

    refusal = approved_admin_refusal(identity)
    if refusal:
        return error_result(refusal)
    rows = [row for item in payload["docs"][:8] if (row := map_result(item))]
    request.session[SESSION_KEY] = {
        "owner": str(identity.pk),
        "at": timezone.now().timestamp(),
        "query": query,
        "rows": rows,
    }
    return 200, [row["result"] for row in rows]


def import_cover(request, result_id):
    record = valid_receipts(request)
    row = (
        next((row for row in record["rows"] if row["result"]["id"] == result_id), None)
        if record
        else None
    )
    if row is None:
        return None
    encoded = None
    if row["coverId"] is not None:
        data, mime = fetch_provider(
            cover_url(row["coverId"]),
            MAX_IMAGE_BYTES,
            "image/jpeg,image/png,image/webp",
        )
        if data is not None:
            try:
                encoded = encode_image(
                    SimpleUploadedFile("provider-cover", data, content_type=mime)
                )
            except ValueError as error:
                raise MetadataUnavailable("Invalid provider image") from error
    return encoded, {"openLibraryWork": row["work"]}
