"""Isolated probes only: no production authentication or club endpoints."""

from django.http import JsonResponse
from django.urls import path
from ninja import NinjaAPI

from config.api import api as real_api
from users.access import PUBLIC_OPERATIONS

invocations = []


def sentinel(request):
    invocations.append(request.path)
    return JsonResponse({"private": "fictional-secret-sentinel"})


probe_api = NinjaAPI(urls_namespace="guard-probes", docs_url=None, openapi_url=None)


@probe_api.post("/typed")
def typed_probe(request, number: int):
    return sentinel(request).content.decode()


urlpatterns = [
    path("probe/private", sentinel),
    path("probe/slash/", sentinel),
    path("probe/api/", probe_api.urls),
    *[
        path(route.lstrip("/"), sentinel)
        for _, route in PUBLIC_OPERATIONS
        if route != "/api/health"
    ],
    path("api/", real_api.urls),
]
