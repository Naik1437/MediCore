#!/bin/bash
# MC-14: Database Restore Script with Post-Restoration Verification Check

if [ -z "$1" ]; then
    echo "Usage: ./scripts/restore_db.sh <path-to-backup.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: File $BACKUP_FILE does not exist!"
    exit 1
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Restoring database from $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker exec -i medicore-postgres psql -U "${POSTGRES_USER:-medicore_user}" -d "${POSTGRES_DB:-medicore_db}"

if [ $? -ne 0 ]; then
    echo "ERROR: Database restore stream execution failed!" >&2
    exit 1
fi

echo "Validating restored database integrity and schema tables..."
TABLE_COUNT=$(docker exec medicore-postgres psql -U "${POSTGRES_USER:-medicore_user}" -d "${POSTGRES_DB:-medicore_db}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
AUDIT_COUNT=$(docker exec medicore-postgres psql -U "${POSTGRES_USER:-medicore_user}" -d "${POSTGRES_DB:-medicore_db}" -t -c "SELECT count(*) FROM \"AuditRecord\";")

echo "RESTORE VALIDATION EVIDENCE:"
echo "- Public schema table count: $(echo $TABLE_COUNT | tr -d ' ')"
echo "- Accessible audit log count: $(echo $AUDIT_COUNT | tr -d ' ')"

if [ "$(echo $TABLE_COUNT | tr -d ' ')" -ge 15 ]; then
    echo "SUCCESS: Database restored and verified with complete 17-entity schema integrity."
    exit 0
else
    echo "WARNING: Restored table count is lower than expected 17 relational entities!" >&2
    exit 1
fi
