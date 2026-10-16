"""Deployment guards must reject real-club storage/auth before Django starts."""

import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "render_startup",
    Path(__file__).resolve().parents[3] / "deploy/render/entrypoint.py",
)
startup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(startup)


def environment(**changes):
    return {
        "DEMO_MODE": "true",
        "RENDER_EXTERNAL_HOSTNAME": "fictional-demo.onrender.com",
        "SECRET_KEY": "fictional-deployment-test-key",
        **changes,
    }


@pytest.mark.parametrize(
    "changes",
    [
        {"DEMO_MODE": "false"},
        {"SECRET_KEY": ""},
        {"RENDER_EXTERNAL_HOSTNAME": "*"},
        {"RENDER_EXTERNAL_HOSTNAME": "https://example.invalid"},
        {"RENDER_EXTERNAL_HOSTNAME": "example.invalid:443"},
        {"RENDER_EXTERNAL_HOSTNAME": "example.invalid/path"},
        {"RENDER_EXTERNAL_HOSTNAME": "example.invalid,other.invalid"},
        {"PORT": "8000"},
        {"PORT": "0"},
        {"PORT": "10000; bad"},
        {"DISCORD_CLIENT_ID": "fictional-would-be-real-config"},
        {"DISCORD_CLIENT_SECRET": "fictional-would-be-real-config"},
        {"DATABASE_PATH": "/data/retained.sqlite3"},
        {"MEDIA_ROOT": "/data/retained-media"},
    ],
)
def test_render_refuses_real_club_or_invalid_configuration(changes):
    with pytest.raises(ValueError):
        startup.configure(environment(**changes))


def test_render_pins_private_production_defaults_without_mutating_input():
    original = environment(DEBUG="true", BOOKCLUB_ENV="development", ALLOWED_HOSTS="*")
    result = startup.configure(original)
    assert result["DEBUG"] == "false" and result["BOOKCLUB_ENV"] == "production"
    assert result["ALLOWED_HOSTS"] == "fictional-demo.onrender.com"
    assert result["DATABASE_PATH"] == "/tmp/bookclub-render/club.sqlite3"
    assert result["TRUST_HTTPS_PROXY"] == "true"
    assert result["DISCORD_CLIENT_ID"] == result["DISCORD_CLIENT_SECRET"] == ""
    assert original["DEBUG"] == "true"
