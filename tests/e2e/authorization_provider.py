"""Local fictional authorization UI; mounted only by the browser-test override."""

import html
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlencode, urlsplit

ORIGIN = os.environ["E2E_CALLBACK_ORIGIN"]
parsed = urlsplit(ORIGIN)
if (
    os.environ.get("BOOKCLUB_ENV") != "test"
    or parsed.scheme != "http"
    or parsed.hostname != "localhost"
    or not parsed.port
    or parsed.path
    or parsed.query
    or parsed.fragment
    or parsed.username
    or parsed.password
):
    raise RuntimeError("Local provider requires an explicit loopback test origin")


class Provider(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # OAuth state/query strings never enter access logs.

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == "/health":
            self.respond(200, "Provider ready")
            return
        params = parse_qs(url.query)
        expected = {
            "client_id": "fictional-browser-client",
            "redirect_uri": f"{ORIGIN}/api/auth/discord/callback",
            "response_type": "code",
            "scope": "identify",
            "code_challenge_method": "S256",
        }
        valid = (
            url.path == "/authorize"
            and all(params.get(key) == [value] for key, value in expected.items())
            and len(params.get("state", [])) == 1
            and 1 <= len(params["state"][0]) <= 256
            and len(params.get("code_challenge", [])) == 1
            and re.fullmatch(r"[A-Za-z0-9_-]{43}", params["code_challenge"][0])
        )
        if not valid:
            self.respond(400, "Unexpected fictional authorization request")
            return
        links = []
        for actor in ("desktop", "mobile"):
            query = urlencode(
                {"state": params["state"][0], "code": f"fictional-{actor}-code"}
            )
            callback = f"{ORIGIN}/api/auth/discord/callback?{query}"
            links.append(
                f'<p><a href="{html.escape(callback, quote=True)}">'
                f"Entrar como {actor}</a></p>"
            )
        self.respond(
            200,
            '<!doctype html><html lang="es"><meta charset="utf-8">'
            "<title>Proveedor ficticio</title><h1>Proveedor ficticio</h1>"
            + "".join(links)
            + "</html>",
        )

    def respond(self, status, body):
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8001), Provider).serve_forever()
