FROM python:3.13-slim AS dependencies
COPY --from=ghcr.io/astral-sh/uv:0.12.7 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev

FROM python:3.13-slim AS runtime
ENV PATH="/app/backend/.venv/bin:$PATH" PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 DEBUG=false \
    DATABASE_PATH=/data/club.sqlite3 MEDIA_ROOT=/data/private_media
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin bookclub \
    && mkdir -p /data/private_media && chown -R bookclub:bookclub /data
WORKDIR /app/backend
COPY --from=dependencies /app/backend/.venv ./.venv
COPY backend ./
COPY openapi.yaml /app/openapi.yaml
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=10s --start-period=30s --retries=12 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=5)"]
ENTRYPOINT ["python", "container_entrypoint.py"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "1", "--threads", "4", "--timeout", "60", "--no-control-socket"]
