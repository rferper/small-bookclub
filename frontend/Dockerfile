FROM node:24-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
ENV VITE_API_MODE=http
ARG CLUB_TIMEZONE=Europe/Madrid
ENV VITE_CLUB_TIMEZONE=$CLUB_TIMEZONE
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=10 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/api/health || exit 1
