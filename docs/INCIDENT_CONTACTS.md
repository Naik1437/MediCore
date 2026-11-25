# MediCore Hospital Incident Response & Emergency Escalation Matrix (MC-14)

This operational document specifies the emergency contact roster, role assignments, and severity escalation procedures for MediCore clinical infrastructure incidents.

## 1. Emergency Escalation Hierarchy

| Tier | Role / Title | Responsibility Scope | Response SLA | Primary Contact | Secondary Contact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1 (P1 - Critical)** | **On-Call Security & Reliability Engineer** | Database outages, cryptographic token breaches, unauthorized PHI exfiltration | **15 minutes** | `sre-oncall@hospital.medicore.local` | `+1-555-0911` |
| **Tier 1 (P1 - Clinical)** | **Chief Medical Information Officer (CMIO)** | Clinical decision workflow blockages, patient mismatch defects | **15 minutes** | `cmio@hospital.medicore.local` | `+1-555-0912` |
| **Tier 2 (P2 - High)** | **Lead Backend & Database Architect** | Concurrency deadlocks, Redis worker retry backlogs, DLQ spikes | **1 hour** | `backend-lead@hospital.medicore.local` | `+1-555-0921` |
| **Tier 2 (P2 - High)** | **Hospital Compliance & Data Privacy Officer** | Consent revocation violations, audit retention anomalies, IDOR attempts | **1 hour** | `privacy-officer@hospital.medicore.local` | `+1-555-0922` |
| **Tier 3 (P3 - Medium)** | **DevOps & Infrastructure Team** | Nginx SSL certificate renewals, storage volume thresholds (>80%) | **4 hours** | `devops@hospital.medicore.local` | Slack: `#medicore-ops` |

---

## 2. Severity Classification Criteria

### Severity 1 (P1) — Critical Incident
- **Condition**: Clinical care blocked, database offline, unauthorized PHI leakage, or patient identifier mismatch.
- **Immediate Action**:
  1. Trigger incident response bridge via on-call SRE.
  2. Isolate compromised services via Docker private network disconnect if security breach detected.
  3. Execute automated database restore from verified backup if data corruption detected (`./scripts/restore_db.sh`).
  4. Complete standardized incident post-mortem within 24 hours (`docs/INCIDENT_REPORT_TEMPLATE.md`).

### Severity 2 (P2) — Major Operational Impairment
- **Condition**: Notification queue backlog exceeding 50 items in DLQ, analytics microservice degraded, non-clinical dashboard latency.
- **Immediate Action**: Inspect DLQ items via `GET /api/v1/notifications/dlq`, trigger worker daemon restart, and review database slow query logs.

---

## 3. Communication Channels
- **Urgent Incident Bridge**: `https://meet.hospital.medicore.local/incident-bridge`
- **Internal Ops Chat**: `#medicore-incidents`
- **Audit Log Verification**: Available to Hospital Administrator via `/api/v1/audit`
