"""Actual Django routing and early-denial telemetry boundaries."""

import pytest
from django.db import connections
from opentelemetry.sdk._logs.export import InMemoryLogRecordExporter
from opentelemetry.sdk.metrics.export import InMemoryMetricReader
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from config import telemetry

pytestmark = pytest.mark.integration


def test_actual_public_route_and_early_denial_are_private_without_database(
    client, monkeypatch
):
    spans, logs, reader = (
        InMemorySpanExporter(),
        InMemoryLogRecordExporter(),
        InMemoryMetricReader(),
    )
    instance = telemetry.Telemetry(
        span_exporter=spans, metric_reader=reader, log_exporter=logs
    )
    monkeypatch.setattr(telemetry, "active", instance)

    def forbidden(*args, **kwargs):
        raise AssertionError("Health/anonymous denial must not connect")

    monkeypatch.setattr(connections["default"], "ensure_connection", forbidden)
    try:
        response = client.get(
            "/api/health?private=fictional-secret",
            HTTP_COOKIE="sessionid=fictional-secret",
        )
        assert response.status_code == 200 and not response.cookies
        assert "traceparent" not in response.headers
        assert client.get("/api/me/profile?private=fictional-secret").status_code == 401
        exported = spans.get_finished_spans()
        assert [s.attributes["http.route"] for s in exported] == [
            "/api/health",
            "unmatched",
        ]
        assert [s.attributes["http.response.status_code"] for s in exported] == [
            200,
            401,
        ]
        assert all(s.parent is None and not s.events for s in exported)
        assert "fictional-secret" not in "".join(s.to_json() for s in exported)
        assert "fictional-secret" not in "".join(
            log.to_json() for log in logs.get_finished_logs()
        )
    finally:
        instance.shutdown()
