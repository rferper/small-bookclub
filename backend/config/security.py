"""Response privacy and database-backed request budgets shared by all workers."""

import json
import logging
from datetime import timedelta
from math import ceil

from django.conf import settings
from django.db import DatabaseError, transaction
from django.http import JsonResponse
from django.utils import timezone
from django.utils.cache import patch_cache_control
from django.utils.crypto import salted_hmac

POLICIES = {
    ("GET", "/api/session"): ("session", 120),
    ("GET", "/api/auth/discord/start"): ("oauth", 30),
    ("GET", "/api/auth/discord/callback"): ("oauth", 30),
    ("GET", "/api/admin/book-metadata"): ("expensive", 20),
    ("GET", "/api/statistics"): ("expensive", 20),
    ("GET", "/api/statistics/compatibility"): ("expensive", 20),
    ("POST", "/api/admin/export"): ("export", 2),
}
if settings.DEMO_MODE:
    POLICIES["POST", "/api/auth/demo"] = ("oauth", 30)


class SafeLogFormatter(logging.Formatter):
    def format(self, record):
        # Never format messages, arguments, exceptions or request objects.
        return json.dumps(
            {
                "level": record.levelname,
                "event": "backend_start"
                if record.name == "bookclub.release"
                else "backend_event",
                "environment": settings.DEPLOYMENT_ENVIRONMENT,
                "version": settings.RELEASE_VERSION,
            }
        )


class PrivacyHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response["X-Robots-Tag"] = "noindex, nofollow, noarchive"
        response["X-Frame-Options"] = "DENY"
        patch_cache_control(response, no_store=True)
        response["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


def consume_budget(key, limit):
    from core.models import RequestBudget

    now = timezone.now()
    with transaction.atomic():
        # The first write reserves SQLite's writer lock before reading counters.
        # This also bounds retention to the active minute on the next request.
        RequestBudget.objects.filter(expires_at__lte=now).delete()
        budget, _ = RequestBudget.objects.get_or_create(
            key=key, defaults={"expires_at": now + timedelta(seconds=60)}
        )
        if budget.count >= limit:
            return max(1, ceil((budget.expires_at - now).total_seconds()))
        budget.count += 1
        budget.save(update_fields=["count"])
    return None


class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        policy = POLICIES.get((request.method, request.path_info))
        if policy is None:
            return self.get_response(request)
        group, limit = policy
        # Never trust client-supplied forwarding headers. A reverse proxy must
        # enforce per-client edge limits too, since REMOTE_ADDR is its address.
        identity = (
            f"member:{request.user.pk}"
            if group in {"expensive", "export"}
            else f"peer:{request.META.get('REMOTE_ADDR', '')}"
        )
        key = salted_hmac("request-budget", f"{group}:{identity}").hexdigest()
        try:
            retry = consume_budget(key, limit)
        except DatabaseError:
            return JsonResponse(
                {"code": "service_unavailable", "message": "Servicio no disponible."},
                status=503,
            )
        if retry:
            response = JsonResponse(
                {"code": "rate_limited", "message": "Demasiadas solicitudes."},
                status=429,
            )
            response["Retry-After"] = str(retry)
            return response
        return self.get_response(request)
