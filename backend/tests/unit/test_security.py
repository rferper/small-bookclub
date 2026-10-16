import io
import json
import logging

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from config.environment import configure
from config.security import SafeLogFormatter
from core.images import encode_image


def test_safe_logs_exclude_message_arguments_request_and_traceback(settings):
    try:
        raise ValueError("fictional sensitive quote")
    except ValueError:
        import sys

        record = logging.LogRecord(
            "django.request",
            logging.ERROR,
            "private-path",
            1,
            "private-url %s",
            ("private-token",),
            sys.exc_info(),
        )
    record.request = "private-body"
    assert json.loads(SafeLogFormatter().format(record)) == {
        "level": "ERROR",
        "event": "backend_event",
        "environment": settings.DEPLOYMENT_ENVIRONMENT,
        "version": settings.RELEASE_VERSION,
    }


def test_startup_emits_closed_release_identity(settings, caplog):
    from django.apps import apps

    settings.DEPLOYMENT_ENVIRONMENT = "staging"
    settings.RELEASE_VERSION = "release-" + "a" * 40
    with caplog.at_level(logging.INFO, logger="bookclub.release"):
        handler = logging.StreamHandler(io.StringIO())
        handler.setFormatter(SafeLogFormatter())
        logger = logging.getLogger("bookclub.release")
        logger.addHandler(handler)
        try:
            apps.get_app_config("core").ready()
            assert json.loads(handler.stream.getvalue()) == {
                "level": "INFO",
                "event": "backend_start",
                "environment": "staging",
                "version": "release-" + "a" * 40,
            }
        finally:
            logger.removeHandler(handler)


def test_production_security_settings_are_explicit(tmp_path):
    settings = configure(
        {
            "BOOKCLUB_ENV": "production",
            "SECRET_KEY": "fictional",
            "ALLOWED_HOSTS": "example.test",
        },
        tmp_path,
    )
    assert settings["SECURE_SSL_REDIRECT"]
    assert settings["SECURE_HSTS_SECONDS"] == 3600
    assert settings["SECURE_PROXY_SSL_HEADER"] is None
    assert settings["SESSION_COOKIE_HTTPONLY"]


@pytest.mark.parametrize("kind", ["script", "oversized", "mime", "pixels"])
def test_images_reject_executable_oversized_mismatched_and_large_dimensions(kind):
    data = io.BytesIO()
    Image.new("RGB", (4001, 4000) if kind == "pixels" else (2, 2)).save(data, "PNG")
    payload = {
        "script": b"<script>fictional</script>",
        "oversized": b"x" * (2 * 1024 * 1024 + 1),
    }.get(kind, data.getvalue())
    upload = SimpleUploadedFile(
        "fictional.png",
        payload,
        content_type="image/jpeg" if kind == "mime" else "image/png",
    )
    with pytest.raises(ValueError):
        encode_image(upload)
