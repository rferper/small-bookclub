"""Inspect actual SDK exports; never rely on a message blacklist for privacy."""

import json
import logging
from pathlib import Path
from types import SimpleNamespace

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.http import HttpResponse
from django.test import RequestFactory
from opentelemetry.sdk._logs.export import InMemoryLogRecordExporter
from opentelemetry.sdk.metrics.export import InMemoryMetricReader
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode

from config import telemetry
from config.environment import configure

SECRET = "fictional-private-content-and-credential"


@pytest.fixture
def pipeline(monkeypatch):
    spans = InMemorySpanExporter()
    metrics = InMemoryMetricReader()
    logs = InMemoryLogRecordExporter()
    instance = telemetry.Telemetry(
        span_exporter=spans, metric_reader=metrics, log_exporter=logs
    )
    monkeypatch.setattr(telemetry, "active", instance)
    yield instance, spans, metrics, logs
    instance.shutdown()


def request(route="api/books/<bookId>", method="GET"):
    req = RequestFactory().generic(
        method,
        f"/api/books/{SECRET}?token={SECRET}",
        data=SECRET.encode(),
        content_type="text/plain",
        HTTP_COOKIE=f"sessionid={SECRET}",
        HTTP_AUTHORIZATION=f"Bearer {SECRET}",
        HTTP_TRACEPARENT="00-" + "a" * 32 + "-" + "b" * 16 + "-01",
        HTTP_BAGGAGE=f"private={SECRET}",
        REMOTE_ADDR="203.0.113.42",
    )
    req.resolver_match = SimpleNamespace(route=route)
    req.user = SimpleNamespace(pk=SECRET, display_name=SECRET)
    return req


def test_actual_sdk_outputs_contain_only_route_method_status_and_release_identity(
    pipeline, settings
):
    instance, spans, metrics, logs = pipeline
    response = HttpResponse(SECRET, status=503)
    result = telemetry.TelemetryMiddleware(lambda req: response)(request())
    assert result is response
    (span,) = spans.get_finished_spans()
    assert span.name == "GET /api/books/{bookId}"
    assert dict(span.attributes) == {
        "http.request.method": "GET",
        "http.route": "/api/books/{bookId}",
        "http.response.status_code": 503,
    }
    assert span.parent is None and span.context.trace_id != int("a" * 32, 16)
    assert span.status.status_code is StatusCode.ERROR
    assert span.status.description is None and not span.events and not span.links
    assert dict(span.resource.attributes) == {
        "service.name": "small-bookclub-backend",
        "service.version": settings.RELEASE_VERSION,
        "deployment.environment.name": settings.DEPLOYMENT_ENVIRONMENT,
    }
    (log,) = logs.get_finished_logs()
    assert log.log_record.body == "http.request"
    assert dict(log.log_record.attributes) == dict(span.attributes)
    assert log.log_record.trace_id == span.context.trace_id
    data = metrics.get_metrics_data()
    instruments = data.resource_metrics[0].scope_metrics[0].metrics
    assert {m.name for m in instruments} == {
        "bookclub.http.requests",
        "http.server.request.duration",
    }
    for metric in instruments:
        (point,) = metric.data.data_points
        assert dict(point.attributes) == dict(span.attributes)
    output = span.to_json() + log.to_json() + data.to_json()
    assert SECRET not in output and "203.0.113.42" not in output


@pytest.mark.parametrize(
    "route,method", [(None, "SECRET"), ("api/private/<secret>", "CONNECT"), ("", "GET")]
)
def test_unknown_routes_and_methods_never_create_dynamic_labels(
    pipeline, route, method
):
    _, spans, _, _ = pipeline
    telemetry.TelemetryMiddleware(lambda req: HttpResponse(status=401))(
        request(route, method)
    )
    (span,) = spans.get_finished_spans()
    assert span.attributes["http.route"] == "unmatched"
    assert span.attributes["http.request.method"] == (
        method if method == "GET" else "OTHER"
    )


def test_business_exception_is_preserved_without_exception_event_or_text(pipeline):
    _, spans, _, logs = pipeline
    error = ValueError(SECRET)

    def fail(req):
        raise error

    with pytest.raises(ValueError) as caught:
        telemetry.TelemetryMiddleware(fail)(request())
    assert caught.value is error
    (span,) = spans.get_finished_spans()
    assert span.attributes["http.response.status_code"] == 500
    assert not span.events and SECRET not in span.to_json()
    assert SECRET not in logs.get_finished_logs()[0].to_json()


def test_metric_series_are_bounded_without_fabricated_statuses(pipeline):
    instance, _, reader, _ = pipeline
    for status in range(100, 600):
        instance.finish(instance.begin(), request(), status, 0.01)
    assert len(instance.series) == 255
    data = reader.get_metrics_data()
    counter = next(
        m
        for m in data.resource_metrics[0].scope_metrics[0].metrics
        if m.name == "bookclub.http.requests"
    )
    assert len(counter.data.data_points) == 256
    assert sum(p.value for p in counter.data.data_points) == 500
    (overflow,) = [
        p
        for p in counter.data.data_points
        if "http.response.status_code" not in p.attributes
    ]
    assert dict(overflow.attributes) == {
        "http.request.method": "OTHER",
        "http.route": "unmatched",
    }


def test_safe_log_handler_projects_messages_exceptions_and_extra_and_avoids_recursion(
    pipeline,
):
    _, _, _, logs = pipeline
    handler = telemetry.SafeTelemetryHandler()
    record = logging.LogRecord(
        "django.request",
        logging.ERROR,
        SECRET,
        1,
        SECRET,
        (SECRET,),
        (ValueError, ValueError(SECRET), None),
    )
    record.request = record.trace_id = record.member_id = SECRET
    handler.emit(record)
    (log,) = logs.get_finished_logs()
    assert log.log_record.body == "backend_event"
    assert dict(log.log_record.attributes) == {"log.level": "ERROR"}
    assert SECRET not in log.to_json()
    for name in ["opentelemetry.exporter", "urllib3", "requests", "bookclub.telemetry"]:
        record.name = name
        handler.emit(record)
    assert len(logs.get_finished_logs()) == 1


def test_telemetry_failure_or_disabled_mode_never_changes_application_result(
    monkeypatch,
):
    response = HttpResponse(status=409)
    monkeypatch.setattr(telemetry, "active", None)
    assert telemetry.TelemetryMiddleware(lambda req: response)(request()) is response

    def fail(*args):
        raise RuntimeError(SECRET)

    monkeypatch.setattr(telemetry, "active", SimpleNamespace(begin=fail))
    assert telemetry.TelemetryMiddleware(lambda req: response)(request()) is response
    monkeypatch.setattr(
        telemetry, "active", SimpleNamespace(begin=lambda: object(), finish=fail)
    )
    assert telemetry.TelemetryMiddleware(lambda req: response)(request()) is response


def test_settings_opt_in_and_initialization_are_explicit_and_failure_safe(
    settings, monkeypatch
):
    base = Path(__file__).parents[2]
    assert configure({}, base)["TELEMETRY_ENABLED"] is False
    assert configure({"TELEMETRY_ENABLED": "TRUE"}, base)["TELEMETRY_ENABLED"] is True
    for value in ["1", SECRET, ""]:
        with pytest.raises(ImproperlyConfigured) as caught:
            configure({"TELEMETRY_ENABLED": value}, base)
        assert SECRET not in str(caught.value)
    settings.TELEMETRY_ENABLED = False
    monkeypatch.setattr(telemetry, "active", None)

    def fail():
        raise RuntimeError(SECRET)

    monkeypatch.setattr(telemetry, "Telemetry", fail)
    telemetry.initialize()
    assert telemetry.active is None
    settings.TELEMETRY_ENABLED = True
    telemetry.initialize()
    assert telemetry.active is None


def test_otlp_wire_boundary_strips_env_headers_credentials_proxies_redirects(
    monkeypatch, pipeline
):
    from opentelemetry.exporter.otlp.proto.http import Compression
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from requests import Response, Session

    monkeypatch.setenv(
        "OTEL_EXPORTER_OTLP_HEADERS", f"Authorization={SECRET},Cookie={SECRET}"
    )
    monkeypatch.setenv("HTTP_PROXY", f"http://{SECRET}.invalid")
    calls = []

    def send(session, prepared, **kwargs):
        calls.append((prepared, kwargs))
        response = Response()
        response.status_code = 200
        response._content = b""
        return response

    monkeypatch.setattr(Session, "send", send)
    session = telemetry.local_session("traces")
    exporter = OTLPSpanExporter(
        endpoint="http://otel-collector:4318/v1/traces",
        session=session,
        compression=Compression.NoCompression,
        timeout=2,
    )
    _, spans, _, _ = pipeline
    telemetry.TelemetryMiddleware(lambda req: HttpResponse())(request())
    exporter.export(spans.get_finished_spans())
    prepared, options = calls[0]
    assert prepared.url == "http://otel-collector:4318/v1/traces"
    assert set(prepared.headers) == {"Content-Type", "Content-Length"}
    assert options["proxies"] == {} and options["allow_redirects"] is False
    assert (
        options["cert"] is None
        and options["timeout"] == 2
        and options["verify"] is True
    )
    assert (
        SECRET not in str(dict(prepared.headers))
        and SECRET.encode() not in prepared.body
    )
    assert session.trust_env is False
    with pytest.raises(ValueError):
        session.post("http://external.invalid/v1/traces", data=b"safe")
    exporter.shutdown()


def test_otel_environment_cannot_add_resource_attributes_or_disable_spans(monkeypatch):
    monkeypatch.setenv(
        "OTEL_RESOURCE_ATTRIBUTES", f"secret={SECRET},service.name={SECRET}"
    )
    monkeypatch.setenv("OTEL_TRACES_SAMPLER", "always_off")
    spans, logs, reader = (
        InMemorySpanExporter(),
        InMemoryLogRecordExporter(),
        InMemoryMetricReader(),
    )
    instance = telemetry.Telemetry(
        span_exporter=spans, metric_reader=reader, log_exporter=logs
    )
    try:
        instance.finish(instance.begin(), request(), 200, 0.01)
        (span,) = spans.get_finished_spans()
        assert SECRET not in json.dumps(dict(span.resource.attributes))
    finally:
        instance.shutdown()
