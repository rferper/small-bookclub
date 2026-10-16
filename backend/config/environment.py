"""Explicit environment configuration, independently testable without Django."""

import re
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.core.exceptions import ImproperlyConfigured


def configure(environ, base_dir):
    environment = environ.get("BOOKCLUB_ENV", "development")
    if environment not in {"development", "test", "demo", "production"}:
        raise ImproperlyConfigured(
            "BOOKCLUB_ENV must be development, test, demo or production"
        )
    production = environment == "production"
    demo_text = environ.get("DEMO_MODE", "false").lower()
    if demo_text not in {"true", "false"}:
        raise ImproperlyConfigured("DEMO_MODE must be true or false")
    deployment = environ.get("DEPLOYMENT_ENVIRONMENT", environment)
    if deployment not in {environment, "staging", "production-demo"} or (
        deployment in {"staging", "production-demo"}
        and (not production or demo_text != "true")
    ):
        raise ImproperlyConfigured("Invalid DEPLOYMENT_ENVIRONMENT")
    revision = environ.get("BOOKCLUB_REVISION", "")
    if revision and not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ImproperlyConfigured("BOOKCLUB_REVISION must be a full lowercase SHA")
    version = f"release-{revision}" if revision else "unversioned"
    debug_text = environ.get(
        "DEBUG", "true" if environment == "development" else "false"
    )
    if debug_text.lower() not in {"true", "false"}:
        raise ImproperlyConfigured("DEBUG must be true or false")
    debug = debug_text.lower() == "true"
    if production and debug:
        raise ImproperlyConfigured("DEBUG must be false in production")
    secret = environ.get("SECRET_KEY", "").strip()
    hosts = [
        host.strip()
        for host in environ.get("ALLOWED_HOSTS", "").split(",")
        if host.strip()
    ]
    if production and (not secret or not hosts):
        raise ImproperlyConfigured(
            "Production requires explicit SECRET_KEY and ALLOWED_HOSTS"
        )
    timezone = environ.get("CLUB_TIMEZONE", "UTC")
    try:
        ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise ImproperlyConfigured(
            "CLUB_TIMEZONE must be a valid IANA timezone"
        ) from error
    database = environ.get("DATABASE_PATH", str(base_dir / f"{environment}.sqlite3"))
    if not database.strip():
        raise ImproperlyConfigured("DATABASE_PATH must not be blank")
    if database != ":memory:" and not Path(database).is_absolute():
        database = str(base_dir / database)
    media_root = environ.get("MEDIA_ROOT", str(base_dir / "private_media"))
    if not media_root.strip():
        raise ImproperlyConfigured("MEDIA_ROOT must not be blank")
    if not Path(media_root).is_absolute():
        media_root = str(base_dir / media_root)
    return {
        "ENVIRONMENT": environment,
        "DEPLOYMENT_ENVIRONMENT": deployment,
        "RELEASE_VERSION": version,
        "DEMO_MODE": demo_text == "true",
        "MEDIA_ROOT": media_root,
        "SECRET_KEY": secret or "public-development-only-key-never-use-in-production",
        "DEBUG": debug,
        "ALLOWED_HOSTS": hosts or ["localhost", "127.0.0.1", "[::1]", "testserver"],
        "LANGUAGE_CODE": "es",
        "TIME_ZONE": timezone,
        "USE_TZ": True,
        "DATABASES": {
            "default": {"ENGINE": "django.db.backends.sqlite3", "NAME": database}
        },
        "SESSION_COOKIE_SECURE": production,
        "CSRF_COOKIE_SECURE": production,
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SAMESITE": "Lax",
        "CSRF_COOKIE_SAMESITE": "Lax",
        "SECURE_SSL_REDIRECT": production,
        "SECURE_HSTS_SECONDS": 3600 if production else 0,
        "SECURE_HSTS_INCLUDE_SUBDOMAINS": False,
        "SECURE_HSTS_PRELOAD": False,
        "SECURE_CONTENT_TYPE_NOSNIFF": True,
        "SECURE_REFERRER_POLICY": "no-referrer",
        # Trust only an explicitly configured, isolated TLS-terminating proxy.
        "SECURE_PROXY_SSL_HEADER": (
            ("HTTP_X_FORWARDED_PROTO", "https")
            if environ.get("TRUST_HTTPS_PROXY", "false").lower() == "true"
            else None
        ),
    }
