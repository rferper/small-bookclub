"""Backend settings; the custom identity precedes all auth-dependent migrations."""

import os
from pathlib import Path

from .environment import configure

BASE_DIR = Path(__file__).resolve().parent.parent
globals().update(configure(os.environ, BASE_DIR))
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
INSTALLED_APPS = [
    "users",
    "core",
    "books",
    "meetings",
    "votes",
    "reviews",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.discord",
]
AUTH_USER_MODEL = "users.User"
MIDDLEWARE = [
    "config.telemetry.TelemetryMiddleware",
    "config.security.PrivacyHeadersMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "config.access.AuthenticationCacheMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "config.access.MembershipMiddleware",
    "config.security.RateLimitMiddleware",
    "django.middleware.common.CommonMiddleware",
    "config.access.RequiredCsrfMiddleware",
]
SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_NAME = "sessionid"
CSRF_COOKIE_NAME = "csrftoken"
CSRF_FAILURE_VIEW = "config.access.csrf_failure"
DATA_UPLOAD_MAX_MEMORY_SIZE = 64 * 1024
DATA_UPLOAD_MAX_NUMBER_FIELDS = 30
DATA_UPLOAD_MAX_NUMBER_FILES = 2
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024

LOGGING = {
    "version": 1,
    "disable_existing_loggers": True,
    "formatters": {"safe": {"()": "config.security.SafeLogFormatter"}},
    "handlers": {
        "safe": {"class": "logging.StreamHandler", "formatter": "safe"},
        "telemetry": {"class": "config.telemetry.SafeTelemetryHandler"},
    },
    "root": {"handlers": ["safe", "telemetry"], "level": "WARNING"},
    "loggers": {
        "bookclub.release": {
            "handlers": ["safe", "telemetry"],
            "level": "INFO",
            "propagate": False,
        },
        "django": {
            "handlers": ["safe", "telemetry"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.server": {
            "handlers": ["safe", "telemetry"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Only the two explicitly mounted API handlers expose provider authentication.
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_USER_MODEL_EMAIL_FIELD = None
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*"]
ACCOUNT_EMAIL_VERIFICATION = "none"
SOCIALACCOUNT_ADAPTER = "users.oauth.ClubSocialAdapter"
SOCIALACCOUNT_STORE_TOKENS = False
SOCIALACCOUNT_EMAIL_AUTHENTICATION = False
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = False
DISCORD_CLIENT_ID = os.environ.get("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.environ.get("DISCORD_CLIENT_SECRET", "")
DISCORD_REDIRECT_URI = os.environ.get("DISCORD_REDIRECT_URI", "")
SOCIALACCOUNT_PROVIDERS = {
    "discord": {
        "SCOPE": ["identify"],
        "OAUTH_PKCE_ENABLED": True,
        "APP": {"client_id": DISCORD_CLIENT_ID, "secret": DISCORD_CLIENT_SECRET},
    }
}
