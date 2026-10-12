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
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "config.access.AuthenticationCacheMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "config.access.MembershipMiddleware",
    "django.middleware.common.CommonMiddleware",
    "config.access.RequiredCsrfMiddleware",
]
SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_NAME = "sessionid"
CSRF_COOKIE_NAME = "csrftoken"
CSRF_FAILURE_VIEW = "config.access.csrf_failure"
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
