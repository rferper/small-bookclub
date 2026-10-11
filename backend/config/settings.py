"""Migration-free bootstrap; #2 adds the custom user before auth applications."""

import os
from pathlib import Path

from .environment import configure

BASE_DIR = Path(__file__).resolve().parent.parent
globals().update(configure(os.environ, BASE_DIR))
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
INSTALLED_APPS = []
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
]
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
