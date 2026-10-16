FROM node:24-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
ENV VITE_API_MODE=http VITE_CLUB_TIMEZONE=Europe/Madrid
RUN npm run build

FROM python:3.13-slim AS dependencies
COPY --from=ghcr.io/astral-sh/uv:0.12.7 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev

FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin bookclub
ENV PATH="/app/backend/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    DATABASE_PATH=/tmp/bookclub-render/club.sqlite3 MEDIA_ROOT=/tmp/bookclub-render/private_media
WORKDIR /app/backend
COPY --from=dependencies /app/backend/.venv ./.venv
COPY backend ./
COPY openapi.yaml /app/openapi.yaml
COPY --from=frontend /app/frontend/dist /app/frontend/dist
COPY deploy/render/entrypoint.py deploy/render/nginx.conf /app/render/
USER 10001:10001
EXPOSE 10000
HEALTHCHECK --interval=10s --timeout=10s --start-period=30s --retries=12 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:'+os.environ.get('PORT','10000')+'/api/health', headers={'Host':os.environ['RENDER_EXTERNAL_HOSTNAME']}), timeout=5)"]
ENTRYPOINT ["python", "/app/render/entrypoint.py"]
