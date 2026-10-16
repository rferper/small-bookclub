"""Render Free fictional demo only; migrate/seed then supervise private WSGI + edge."""

import os
import re
import signal
import subprocess
import sys
import time
from pathlib import Path

DATA = "/tmp/bookclub-render"


def configure(environ):
    """Refuse retained/real-club configuration before starting Django."""
    env = dict(environ)
    if not re.fullmatch(r"[a-f0-9]{40}", env.get("RENDER_GIT_COMMIT", "")):
        raise ValueError("A full provider revision is required")
    if env.get("DEMO_MODE", "").lower() != "true":
        raise ValueError("Render image requires explicit fictional demo mode")
    host = env.get("RENDER_EXTERNAL_HOSTNAME", "")
    if (
        not host
        or len(host) > 253
        or any(
            not re.fullmatch(r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?", label)
            for label in host.split(".")
        )
    ):
        raise ValueError("An explicit hostname is required")
    port = env.get("PORT", "10000")
    if not re.fullmatch(r"[0-9]{1,5}", port) or not 1024 <= int(port) <= 65535:
        raise ValueError("Invalid edge port")
    if int(port) == 8000:
        raise ValueError("Edge and private WSGI ports must differ")
    if not env.get("SECRET_KEY", "").strip():
        raise ValueError("A private per-service secret is required")
    if any(env.get(key) for key in ("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET")):
        raise ValueError("Real provider credentials are forbidden in this demo")
    for key, expected in {
        "DATABASE_PATH": f"{DATA}/club.sqlite3",
        "MEDIA_ROOT": f"{DATA}/private_media",
    }.items():
        if env.get(key, expected) != expected:
            raise ValueError("Render demo must use its dedicated ephemeral storage")
        env[key] = expected
    env.update(
        BOOKCLUB_ENV="production",
        DEBUG="false",
        DEMO_MODE="true",
        ALLOWED_HOSTS=host,
        TRUST_HTTPS_PROXY="true",
        DISCORD_CLIENT_ID="",
        DISCORD_CLIENT_SECRET="",
        DISCORD_REDIRECT_URI="",
        PORT=str(int(port)),
    )
    return env


def serve(env):
    children = []
    stopping = False

    def stop(signum, frame):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        children.append(
            subprocess.Popen(
                [
                    "gunicorn",
                    "config.wsgi:application",
                    "--bind",
                    "127.0.0.1:8000",
                    "--workers",
                    "1",
                    "--threads",
                    "4",
                    "--timeout",
                    "60",
                    "--no-control-socket",
                ],
                env=env,
            )
        )
        children.append(
            subprocess.Popen(
                ["nginx", "-c", "/tmp/render-nginx.conf", "-g", "daemon off;"],
                env=env,
            )
        )
        while not stopping:
            if any(child.poll() is not None for child in children):
                return 1  # Unexpected exit of either service fails the container.
            time.sleep(0.2)
        return 0
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        deadline = time.monotonic() + 10
        for child in children:
            try:
                child.wait(timeout=max(0.1, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait(timeout=5)


def main():
    try:
        env = configure(os.environ)
        Path(DATA).mkdir(mode=0o700, exist_ok=True)
        template = Path("/app/render/nginx.conf").read_text()
        Path("/tmp/render-nginx.conf").write_text(
            template.replace("__PORT__", env["PORT"]).replace(
                "__REVISION__", env["RENDER_GIT_COMMIT"]
            )
        )
        for command in ("migrate", "seed_demo"):
            arguments = [sys.executable, "manage.py", command]
            if command == "migrate":
                arguments.append("--noinput")
            subprocess.run(arguments, env=env, check=True, timeout=120)
        subprocess.run(
            ["nginx", "-t", "-c", "/tmp/render-nginx.conf"],
            env=env,
            check=True,
            timeout=10,
        )
        return serve(env)
    except (ValueError, OSError, subprocess.SubprocessError):
        print("Fictional demo startup failed.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
