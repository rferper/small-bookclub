"""Opt-in local OTLP only. Project safe fields instead of auto-instrumenting data."""

import atexit
import logging
import re
from threading import Lock
from time import perf_counter

from django.conf import settings

active = None
METHODS = {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
ATTRIBUTES = {"http.request.method", "http.route", "http.response.status_code"}


def local_session(signal):
    from requests import Session

    if signal not in {"traces", "metrics", "logs"}:
        raise ValueError("Invalid local telemetry signal")
    endpoint = f"http://otel-collector:4318/v1/{signal}"

    class LocalSession(Session):
        def send(self, request, **kwargs):
            if (
                request.url != endpoint
                or request.method != "POST"
                or not isinstance(request.body, bytes)
            ):
                raise ValueError("Invalid local telemetry request")
            # The SDK merges OTEL_*_HEADERS even with explicit constructor headers.
            # Project the final prepared request, including headers from cookies/netrc.
            request.headers.clear()
            request.headers.update(
                {
                    "Content-Type": "application/x-protobuf",
                    "Content-Length": str(len(request.body)),
                }
            )
            kwargs.update(
                proxies={}, verify=True, cert=None, allow_redirects=False, timeout=2
            )
            return super().send(request, **kwargs)

    session = LocalSession()
    session.trust_env = False
    return session


class Telemetry:
    def __init__(self, *, span_exporter=None, metric_reader=None, log_exporter=None):
        self.sessions = []
        self.traces = self.logs = self.metrics = None
        try:
            self._setup(
                span_exporter=span_exporter,
                metric_reader=metric_reader,
                log_exporter=log_exporter,
            )
        except Exception:
            self.shutdown()
            raise

    def _setup(self, *, span_exporter, metric_reader, log_exporter):
        # Do not load the SDK or create export threads for normal/Render startup.
        from opentelemetry.sdk._logs import LoggerProvider
        from opentelemetry.sdk._logs.export import (
            BatchLogRecordProcessor,
            SimpleLogRecordProcessor,
        )
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
        from opentelemetry.sdk.metrics.view import (
            ExplicitBucketHistogramAggregation,
            View,
        )
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import SpanLimits, TracerProvider
        from opentelemetry.sdk.trace.export import (
            BatchSpanProcessor,
            SimpleSpanProcessor,
        )
        from opentelemetry.sdk.trace.sampling import ALWAYS_ON

        from config.contract import read_contract

        self.routes = frozenset(read_contract()["paths"])
        # Resource.create() runs environment detectors; deliberately avoid it.
        resource = Resource(
            {
                "service.name": "small-bookclub-backend",
                "service.version": settings.RELEASE_VERSION,
                "deployment.environment.name": settings.DEPLOYMENT_ENVIRONMENT,
            }
        )
        self.sessions = []
        self.series = set()
        self.series_lock = Lock()
        self.traces = TracerProvider(
            resource=resource,
            shutdown_on_exit=False,
            sampler=ALWAYS_ON,
            span_limits=SpanLimits(
                max_attributes=8, max_events=0, max_links=0, max_attribute_length=128
            ),
        )
        self.logs = LoggerProvider(resource=resource, shutdown_on_exit=False)
        if span_exporter is not None:
            self.traces.add_span_processor(SimpleSpanProcessor(span_exporter))
            self.logs.add_log_record_processor(SimpleLogRecordProcessor(log_exporter))
        else:
            from opentelemetry.exporter.otlp.proto.http._log_exporter import (
                OTLPLogExporter,
            )
            from opentelemetry.exporter.otlp.proto.http.metric_exporter import (
                OTLPMetricExporter,
            )
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
                OTLPSpanExporter,
            )

            self.traces.add_span_processor(
                BatchSpanProcessor(
                    self.exporter(OTLPSpanExporter, "traces"),
                    max_queue_size=256,
                    max_export_batch_size=32,
                    schedule_delay_millis=1000,
                    export_timeout_millis=3000,
                )
            )
            self.logs.add_log_record_processor(
                BatchLogRecordProcessor(
                    self.exporter(OTLPLogExporter, "logs"),
                    max_queue_size=256,
                    max_export_batch_size=32,
                    schedule_delay_millis=1000,
                    export_timeout_millis=3000,
                )
            )
            metric_reader = PeriodicExportingMetricReader(
                self.exporter(OTLPMetricExporter, "metrics"),
                export_interval_millis=5000,
                export_timeout_millis=3000,
            )
        self.metrics = MeterProvider(
            resource=resource,
            metric_readers=[metric_reader],
            shutdown_on_exit=False,
            views=[
                View(
                    instrument_name="bookclub.http.requests",
                    attribute_keys=ATTRIBUTES,
                ),
                View(
                    instrument_name="http.server.request.duration",
                    attribute_keys=ATTRIBUTES,
                    aggregation=ExplicitBucketHistogramAggregation(
                        [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
                    ),
                ),
            ],
        )
        self.tracer = self.traces.get_tracer("bookclub.http")
        self.logger = self.logs.get_logger("bookclub.operational")
        meter = self.metrics.get_meter("bookclub.http")
        self.requests = meter.create_counter("bookclub.http.requests", unit="{request}")
        self.duration = meter.create_histogram("http.server.request.duration", unit="s")

    def exporter(self, exporter_class, signal):
        from opentelemetry.exporter.otlp.proto.http import Compression

        session = local_session(signal)
        self.sessions.append(session)
        return exporter_class(
            endpoint=f"http://otel-collector:4318/v1/{signal}",
            session=session,
            headers={"X-Bookclub-Local": "1"},
            timeout=2,
            compression=Compression.NoCompression,
        )

    def begin(self):
        from opentelemetry.context import Context
        from opentelemetry.trace import SpanKind

        # Never extract incoming traceparent/baggage or inherit arbitrary contexts.
        return self.tracer.start_span(
            "HTTP request", kind=SpanKind.SERVER, context=Context()
        )

    def finish(self, span, request, status, duration):
        from opentelemetry._logs import SeverityNumber
        from opentelemetry.context import Context
        from opentelemetry.trace import StatusCode, set_span_in_context

        route = getattr(getattr(request, "resolver_match", None), "route", "")
        route = route if isinstance(route, str) else ""
        route = "/" + re.sub(r"<(?:[^:>]+:)?([^>]+)>", r"{\1}", route).lstrip("/")
        route = route if route in self.routes else "unmatched"
        method = request.method if request.method in METHODS else "OTHER"
        status = status if isinstance(status, int) and 100 <= status <= 599 else 500
        attributes = {
            "http.request.method": method,
            "http.route": route,
            "http.response.status_code": status,
        }
        duration = min(3600, max(0, duration))
        span.update_name(f"{method} {route}")
        span.set_attributes(attributes)
        if status >= 500:
            span.set_status(StatusCode.ERROR)  # No exception/status description.
        span.end()
        context = set_span_in_context(span, Context())
        with self.series_lock:
            key = (method, route, status)
            if key in self.series or len(self.series) < 255:
                self.series.add(key)
                metric_attributes = attributes
            else:
                # Keep totals without inventing a status or unbounded series.
                metric_attributes = {
                    "http.request.method": "OTHER",
                    "http.route": "unmatched",
                }
        self.requests.add(1, metric_attributes, context=context)
        self.duration.record(duration, metric_attributes, context=context)
        self.logger.emit(
            body="http.request",
            attributes=attributes,
            context=context,
            severity_number=SeverityNumber.INFO,
        )

    def shutdown(self):
        for provider in (self.traces, self.logs, self.metrics):
            try:
                provider.force_flush(timeout_millis=3000)
                provider.shutdown()
            except Exception:
                pass  # Monitoring cannot prevent process termination.
        for session in self.sessions:
            session.close()


def initialize():
    global active
    if settings.TELEMETRY_ENABLED and active is None:
        try:
            active = Telemetry()
            atexit.register(active.shutdown)
        except Exception:
            active = None  # No raw exception; the application still boots.
            logging.getLogger("bookclub.telemetry").warning("telemetry unavailable")


class SafeTelemetryHandler(logging.Handler):
    def emit(self, record):
        # Exporter errors must never recursively feed their own export queue.
        if active is None or record.name.startswith(
            ("opentelemetry", "urllib3", "requests", "bookclub.telemetry")
        ):
            return
        try:
            from opentelemetry._logs import SeverityNumber
            from opentelemetry.context import Context

            event = (
                "backend_start"
                if record.name == "bookclub.release"
                else "backend_event"
            )
            level = (
                record.levelname
                if record.levelname in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
                else "UNKNOWN"
            )
            active.logger.emit(
                body=event,
                attributes={"log.level": level},
                context=Context(),
                severity_number={
                    "DEBUG": SeverityNumber.DEBUG,
                    "INFO": SeverityNumber.INFO,
                    "WARNING": SeverityNumber.WARN,
                    "ERROR": SeverityNumber.ERROR,
                    "CRITICAL": SeverityNumber.FATAL,
                }.get(level, SeverityNumber.UNSPECIFIED),
            )
        except Exception:
            pass  # Preserve the ordinary closed console handler.


class TelemetryMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        telemetry = active
        if telemetry is None:
            return self.get_response(request)
        try:
            span = telemetry.begin()
        except Exception:
            return self.get_response(request)
        start = perf_counter()
        status = 500
        try:
            response = self.get_response(request)
            status = response.status_code
            return response
        finally:
            try:
                telemetry.finish(span, request, status, perf_counter() - start)
            except Exception:
                pass  # Never change a response or replace a business exception.
