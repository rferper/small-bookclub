"""Read-only test mount: replace only Discord's external token/profile boundary.

Normal images and config.wsgi do not contain/import this root test directory.
The real OAuth adapter, state/PKCE checks, session and all club APIs remain active.
"""

import json
import os
from urllib.parse import urlsplit

import requests

if os.environ.get("BOOKCLUB_ENV") != "test" or os.environ.get("DEMO_MODE") != "false":
    raise RuntimeError(
        "Browser provider fixture requires the isolated test configuration"
    )

ACTORS = {
    "fictional-desktop-code": "990000000000000005",
    "fictional-mobile-code": "990000000000000006",
}


def provider_boundary(self, method, url, **kwargs):
    if method.upper() == "POST" and url == "https://discord.com/api/oauth2/token":
        data = kwargs.get("data", {})
        code = data.get("code")
        if code not in ACTORS or not data.get("code_verifier"):
            raise requests.ConnectionError("Unexpected fictional OAuth exchange")
        payload = {"access_token": code, "token_type": "Bearer"}
    elif method.upper() == "GET" and url == "https://discord.com/api/users/@me":
        code = (
            kwargs.get("headers", {}).get("Authorization", "").removeprefix("Bearer ")
        )
        if code not in ACTORS:
            raise requests.ConnectionError("Unknown fictional provider token")
        payload = {"id": ACTORS[code]}
    else:
        raise requests.ConnectionError(
            "Unexpected external request in isolated browser test"
        )
    response = requests.Response()
    response.status_code = 200
    response.headers["content-type"] = "application/json"
    response._content = json.dumps(payload).encode("utf-8")
    return response


requests.sessions.Session.request = provider_boundary

from config.wsgi import application  # noqa: E402, F401
from users.oauth import ClubDiscordAdapter  # noqa: E402

origin = os.environ["E2E_PROVIDER_ORIGIN"]
parsed = urlsplit(origin)
if (
    parsed.scheme != "http"
    or parsed.hostname != "localhost"
    or not parsed.port
    or parsed.path
    or parsed.query
    or parsed.fragment
    or parsed.username
    or parsed.password
):
    raise RuntimeError("Provider fixture requires an explicit local origin")
ClubDiscordAdapter.authorize_url = f"{origin}/authorize"
