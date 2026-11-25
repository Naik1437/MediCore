# MediCore Incident Report & Evidence Capture Template (MC-15)

## 1. Incident Classification
- **Incident ID**: INC-YYYYMMDD-001
- **Severity**: SEV-1 (Critical Clinical Impact) / SEV-2 (Operational Degraded) / SEV-3 (Informational)
- **Reported At**: YYYY-MM-DD HH:MM UTC
- **Incident Commander**: @medicore/security-officers

---

## 2. Executive Summary
<!-- Brief description of the failure event, clinical impact, and affected services -->

---

## 3. Incident Scenarios & Standard Recovery Procedures

### Scenario A: Unauthorized Record Access Detected
- **Detection**: Audit record alert in `AuditRecord` table with `status = 'DENIED'` and `action = 'UNAUTHORIZED_ACCESS'`.
- **Immediate Containment**: Invalidate active session tokens (`POST /api/v1/auth/logout`) and revoke user refresh session.
- **Root Cause Analysis**: Inspect IP address, request ID, and route path from audit log. Confirm that no PHI was leaked in response payload.

### Scenario B: Appointment Scheduling Collision
- **Detection**: Concurrency lock contention or 409 Conflict spike on `/api/v1/appointments`.
- **Procedure**: System automatically rollbacks transaction. Receptionist / Patient interface displays slot conflict alert and re-queries `/providers/:id/availability`.

### Scenario C: Notification Queue Backlog or Worker Stalling
- **Detection**: Healthcheck file `/tmp/worker_healthy` age exceeds 30 seconds or DLQ count increases.
- **Procedure**: Worker daemon restarts cleanly without message duplication due to Redis SETNX idempotency keys. Re-queue DLQ items after resolving downstream provider.

### Scenario D: Database Connectivity Outage
- **Detection**: Health endpoint `/api/v1/health/ready` returns 503.
- **Procedure**: Run `./scripts/restore_db.sh <latest-backup.sql.gz>` from daily backups volume.

### Scenario E: Diagnostic Lab Patient Mismatch Attempt
- **Detection**: Laboratory result submission rejected with `LAB_PATIENT_MISMATCH`.
- **Procedure**: Audit trail alerts Chief Medical Officer and Laboratory Supervisor for specimen chain-of-custody review.
