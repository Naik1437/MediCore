#!/usr/bin/env bash
set -Eeuo pipefail
# MC-14: Database Backup and Audit Retention Script
# Strict zero-cost native PostgreSQL utility execution
#
# AUTOMATED BACKUP SCHEDULING (CRONTAB):
# To schedule nightly automated backups at 02:00 AM UTC:
# Run: crontab -e
# Add: 0 2 * * * /bin/bash /opt/medicore/scripts/backup_db.sh >> /var/log/medicore_backup.log 2>&1

CONTAINER_NAME="${POSTGRES_CONTAINER:-medicore-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/medicore_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: docker is required." >&2
    exit 1
fi
if [[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true)" != "true" ]]; then
    echo "ERROR: PostgreSQL container '$CONTAINER_NAME' is not running." >&2
    exit 1
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting MediCore PostgreSQL backup..."
if ! docker exec "$CONTAINER_NAME" pg_dump -U "${POSTGRES_USER:-medicore_user}" -d "${POSTGRES_DB:-medicore_db}" | gzip > "$BACKUP_FILE"; then
    rm -f "$BACKUP_FILE"
    echo "ERROR: pg_dump failed; incomplete backup removed." >&2
    exit 1
fi

if [ $? -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup completed successfully: $BACKUP_FILE ($FILE_SIZE)"

    # Audit retention policy: retain daily backups for 30 days, purge older
    find "$BACKUP_DIR" -type f -name "medicore_backup_*.sql.gz" -mtime +30 -exec rm -f {} \;
    echo "Audit retention policy verified (backups > 30 days cleaned)."
    exit 0
else
    echo "ERROR: Backup creation failed or produced empty archive!" >&2
    rm -f "$BACKUP_FILE"
    exit 1
fi
