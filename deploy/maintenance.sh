#!/bin/sh
# Operator-only wrapper: explicit project/config; no inferred owner instance.
set -eu
: "${BOOKCLUB_DIR:?Set the absolute repository directory}"
: "${BOOKCLUB_ENV_FILE:?Set the absolute private Compose environment file}"
: "${BOOKCLUB_PROJECT:?Set the intended retained Compose project}"
cd "$BOOKCLUB_DIR"
compose() {
    docker compose --env-file "$BOOKCLUB_ENV_FILE" -p "$BOOKCLUB_PROJECT" \
        -f docker-compose.yml -f deploy/compose.production.yml "$@"
}
case "${1:-}" in
    backup)
        compose exec -T backend python manage.py backup_club \
            --destination /backups --keep "${BACKUP_KEEP:-7}"
        ;;
    purge|purge-dry-run)
        : "${PURGE_ACTOR_ID:?Set an approved native administrator ID}"
        if [ "$1" = purge-dry-run ]; then
            compose exec -T backend python manage.py purge_expired \
                --actor-id "$PURGE_ACTOR_ID" --dry-run
        else
            compose exec -T backend python manage.py purge_expired \
                --actor-id "$PURGE_ACTOR_ID"
        fi
        ;;
    *)
        echo 'Usage: maintenance.sh backup|purge|purge-dry-run' >&2
        exit 2
        ;;
esac
