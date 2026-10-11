from pathlib import Path

import pytest
from django.core.exceptions import ImproperlyConfigured

from config.environment import configure

BASE = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize("environment", ["development", "test", "demo", "production"])
def test_documented_environments_have_explicit_spanish_sqlite_configuration(
    environment,
):
    env = {
        "BOOKCLUB_ENV": environment,
        "SECRET_KEY": "fictional-test-key",
        "ALLOWED_HOSTS": "example.test",
    }
    settings = configure(env, BASE)
    assert settings["ENVIRONMENT"] == environment
    assert settings["LANGUAGE_CODE"] == "es"
    assert settings["TIME_ZONE"] == "UTC"
    assert settings["USE_TZ"] is True
    assert settings["DATABASES"]["default"]["ENGINE"] == "django.db.backends.sqlite3"
    assert settings["SESSION_COOKIE_SECURE"] is (environment == "production")
    assert settings["CSRF_COOKIE_SECURE"] is (environment == "production")
    assert settings["DEBUG"] is (environment == "development")


@pytest.mark.parametrize(
    "environ, message",
    [
        ({"BOOKCLUB_ENV": "staging"}, "BOOKCLUB_ENV"),
        ({"DEBUG": "1"}, "DEBUG"),
        ({"DEBUG": ""}, "DEBUG"),
        ({"CLUB_TIMEZONE": "Unknown/Club"}, "CLUB_TIMEZONE"),
        ({"CLUB_TIMEZONE": ""}, "CLUB_TIMEZONE"),
        ({"BOOKCLUB_ENV": "production"}, "SECRET_KEY and ALLOWED_HOSTS"),
        ({"BOOKCLUB_ENV": "production", "SECRET_KEY": "fictional"}, "ALLOWED_HOSTS"),
        ({"BOOKCLUB_ENV": "production", "ALLOWED_HOSTS": "example.test"}, "SECRET_KEY"),
        ({"BOOKCLUB_ENV": "production", "DEBUG": "true"}, "DEBUG"),
        ({"DATABASE_PATH": " "}, "DATABASE_PATH"),
    ],
)
def test_invalid_environment_fails_clearly(environ, message):
    with pytest.raises(ImproperlyConfigured, match=message):
        configure(environ, BASE)


def test_custom_timezone_database_hosts_and_boolean_are_parsed():
    settings = configure(
        {
            "CLUB_TIMEZONE": "Europe/Madrid",
            "DATABASE_PATH": "fictional.sqlite3",
            "ALLOWED_HOSTS": " localhost, example.test ,",
            "DEBUG": "FALSE",
        },
        BASE,
    )
    assert settings["TIME_ZONE"] == "Europe/Madrid"
    assert settings["DATABASES"]["default"]["NAME"] == str(BASE / "fictional.sqlite3")
    assert settings["ALLOWED_HOSTS"] == ["localhost", "example.test"]
    assert settings["DEBUG"] is False


def test_memory_database_and_defaults_do_not_depend_on_machine_timezone():
    settings = configure({"DATABASE_PATH": ":memory:"}, BASE)
    assert settings["TIME_ZONE"] == "UTC"
    assert settings["DATABASES"]["default"]["NAME"] == ":memory:"


def test_no_auth_models_or_migrations_are_installed(settings):
    from django.apps import apps

    assert settings.INSTALLED_APPS == []
    assert list(apps.get_models()) == []
