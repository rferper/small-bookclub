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
        "RENDER_GIT_COMMIT": "1" * 40,
        "RENDER_SERVICE_ID": "srv-db8tjebbc2fs73c55du0",
        **changes,
    }


@pytest.mark.parametrize(
    "changes",
    [
        {"DEMO_MODE": "false"},
        {"RENDER_SERVICE_ID": "fictional-unknown-service"},
        {"RENDER_SERVICE_ID": ""},
        {"RENDER_GIT_COMMIT": ""},
        {"RENDER_GIT_COMMIT": "abc123"},
        {"RENDER_GIT_COMMIT": "x" * 40},
        {"RENDER_GIT_COMMIT": "1" * 40 + "; invalid"},
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
    original = environment(
        DEBUG="true",
        BOOKCLUB_ENV="development",
        ALLOWED_HOSTS="*",
        TELEMETRY_ENABLED="true",
    )
    result = startup.configure(original)
    assert result["DEBUG"] == "false" and result["BOOKCLUB_ENV"] == "production"
    assert result["ALLOWED_HOSTS"] == "fictional-demo.onrender.com"
    assert result["DATABASE_PATH"] == "/tmp/bookclub-render/club.sqlite3"
    assert result["TRUST_HTTPS_PROXY"] == "true"
    assert result["DISCORD_CLIENT_ID"] == result["DISCORD_CLIENT_SECRET"] == ""
    assert original["DEBUG"] == "true"
    assert result["BOOKCLUB_REVISION"] == "1" * 40
    assert result["TELEMETRY_ENABLED"] == "false"
    assert result["DEPLOYMENT_ENVIRONMENT"] == "staging"


def test_render_identity_cannot_be_overridden_and_local_world_is_explicit():
    result = startup.configure(
        environment(
            RENDER_SERVICE_ID="srv-db8tjebbc2fs73c55dtg",
            DEPLOYMENT_ENVIRONMENT="staging",
            BOOKCLUB_REVISION="a" * 40,
        )
    )
    assert result["DEPLOYMENT_ENVIRONMENT"] == "production-demo"
    assert result["BOOKCLUB_REVISION"] == "1" * 40
    local = environment(RENDER_SERVICE_ID="", RENDER_EXTERNAL_HOSTNAME="localhost")
    for world in ["staging", "production-demo"]:
        assert (
            startup.configure({**local, "DEPLOYMENT_ENVIRONMENT": world})[
                "DEPLOYMENT_ENVIRONMENT"
            ]
            == world
        )
    for world in ["development", "fictional-secret", ""]:
        with pytest.raises(ValueError):
            startup.configure({**local, "DEPLOYMENT_ENVIRONMENT": world})
