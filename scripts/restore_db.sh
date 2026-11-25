#!/bin/bash
# MC-14: Database Restore Script

if [ -z "$1" ]; then
    echo "Usage: ./scripts/restore_db.sh <path-to-backup.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: File $BACKUP_FILE does not exist!"
    exit 1
fi

echo "Restoring database from $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker exec -i medicore-postgres psql -U "${POSTGRES_USER:-medicore_user}" -d "${POSTGRES_DB:-medicore_db}"

if [ $? -eq 0 ]; then
    echo "Database restore completed successfully."
else
    echo "ERROR: Database restore failed!" >&2
    exit 1
fi
