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
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
]
AUTH_USER_MODEL = "users.User"
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "config.access.MembershipMiddleware",
    "django.middleware.common.CommonMiddleware",
    "config.access.RequiredCsrfMiddleware",
]
SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_NAME = "sessionid"
CSRF_COOKIE_NAME = "csrftoken"
CSRF_FAILURE_VIEW = "config.access.csrf_failure"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
