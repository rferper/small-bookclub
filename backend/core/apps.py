import logging

from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        from config.telemetry import initialize

        initialize()
        logging.getLogger("bookclub.release").info("startup")
