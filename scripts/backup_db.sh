#!/bin/bash
# MC-14: Database Backup and Audit Retention Script
# Strict zero-cost native PostgreSQL utility execution

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/medicore_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Starting MediCore PostgreSQL database backup..."
docker exec medicore-postgres pg_dump -U "${POSTGRES_USER:-medicore_user}" -d "${POSTGRES_DB:-medicore_db}" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "Backup completed successfully: $BACKUP_FILE"
    # Audit retention policy: retain backups for 30 days, purge older
    find "$BACKUP_DIR" -type f -name "medicore_backup_*.sql.gz" -mtime +30 -exec rm {} \;
    echo "Audit retention policy verified (backups > 30 days cleaned)."
else
    echo "ERROR: Backup failed!" >&2
    exit 1
fi
