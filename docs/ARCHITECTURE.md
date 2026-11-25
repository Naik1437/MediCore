# MediCore Enterprise Hospital Platform — Architecture & Assessment Traceability

---

## 1. System Architecture Diagram

```mermaid
flowchart TD
    Client["Browser / Mobile Client"] -->|HTTPS 443 / HTTP 80| NGINX["NGINX TLS Reverse Proxy\n(docker/nginx.conf)"]

    subgraph PublicServices["Public Ingress Layer"]
        NGINX -->|Route /| Frontend["Next.js 14 Frontend\n(Port 3002, React 18, Tailwind)"]
        NGINX -->|Route /api/v1| Backend["Express API Gateway\n(Port 4002, TypeScript, Node.js 22)"]
        NGINX -->|Route /analytics| Analytics["FastAPI Analytics Engine\n(Port 8002, Python 3.11)"]
    end

    subgraph InternalServices["Private Internal Service Layer"]
        Backend <-->|Internal S2S Key / Auth| Analytics
        Analytics -->|Push FIFO Jobs| RedisQueue[("Redis 7 In-Memory Broker\n(Port 6379, Private Network)")]
        Worker["Notification Worker Daemon\n(analytics/worker_daemon.py)"] <-->|Consume & DLQ| RedisQueue
    end

    subgraph AuthoritativePersistence["Authoritative Relational Data Layer"]
        Backend <-->|Prisma ORM Connection Pool| Postgres[("PostgreSQL 16 Clinical DB\n(Port 5432, Private Network)\n17 Relational Entities")]
    end
```

---

## 2. Relational Entity-Relationship (ER) Diagram (17 Entities)

```mermaid
erDiagram
    User ||--o| Patient : "has profile"
    User ||--o| Provider : "has profile"
    User ||--o| Staff : "has profile"
    User ||--o{ RefreshSession : "owns sessions"
    User ||--o{ AuditRecord : "triggers audits"

    Department ||--o{ Provider : "employs"
    Department ||--o{ Staff : "employs"
    Department ||--o{ Appointment : "categorizes"
    Department ||--o{ WaitingList : "queues"
    Department ||--o{ LabOrder : "fulfills"

    Provider ||--o{ ProviderSchedule : "schedules slots"
    Provider ||--o{ Appointment : "attends"
    Provider ||--o{ Encounter : "leads consultation"
    Provider ||--o{ MedicationOrder : "prescribes"
    Provider ||--o{ LabOrder : "orders"

    Patient ||--o{ Appointment : "books"
    Patient ||--o{ WaitingList : "waits"
    Patient ||--o{ Encounter : "participates"
    Patient ||--o{ Diagnosis : "receives"
    Patient ||--o{ MedicationOrder : "takes"
    Patient ||--o{ LabOrder : "tested"
    Patient ||--o{ LabResult : "results"
    Patient ||--o{ Invoice : "billed"
    Patient ||--o{ Consent : "governs directives"

    Appointment ||--o| Encounter : "progresses to"
    Encounter ||--o{ Diagnosis : "documents"
    Encounter ||--o{ MedicationOrder : "contains"
    Encounter ||--o{ LabOrder : "dispatches"

    LabOrder ||--o| LabResult : "verified by"
    User ||--o{ LabResult : "technician verifies"
```

---

## 3. End-to-End Clinical Data-Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Patient as Patient / Receptionist
    actor Nurse as Nurse
    actor Doctor as Doctor
    actor Tech as Lab Technician
    actor Billing as Billing Officer
    participant API as Express Gateway (:4002)
    participant DB as PostgreSQL 16 (:5432)
    participant Worker as Redis Notification Worker
    participant Analytics as FastAPI Analytics (:8002)

    Note over Patient,API: Phase 1: Registration & Appointment Booking
    Patient->>API: POST /api/v1/patients (Register with MRN)
    API->>DB: INSERT into "Patient"
    Patient->>API: POST /api/v1/appointments (Book time slot)
    API->>DB: Check pg_advisory_xact_lock & 'appointment_no_overlap'
    API->>Worker: Dispatch APPT_CONFIRMATION email job
    Worker-->>Patient: Delivers Sandbox Notification

    Note over Patient,Nurse: Phase 2: Check-In & Nursing Triage
    Patient->>API: POST /api/v1/appointments/:id/check-in
    API->>DB: UPDATE Appointment status = 'CHECKED_IN'
    Nurse->>API: POST /api/v1/encounters (Initiate Triage)
    API->>DB: INSERT Encounter (status = 'IN_PROGRESS', vital signs)

    Note over Nurse,Doctor: Phase 3: Physician Consultation & Orders
    Doctor->>API: POST /api/v1/encounters/:id/diagnoses (Record ICD-10)
    API->>DB: INSERT Diagnosis (Enforces duplicate ICD rejection)
    Doctor->>API: POST /api/v1/encounters/:id/prescriptions
    API->>DB: INSERT MedicationOrder
    Doctor->>API: POST /api/v1/lab/orders (Dispatch Lab Test)
    API->>DB: INSERT LabOrder (status = 'ORDERED')

    Note over Tech,Doctor: Phase 4: Diagnostic Processing
    Tech->>API: PATCH /api/v1/lab/orders/:id/status (SAMPLE_COLLECTED -> IN_PROGRESS)
    Tech->>API: POST /api/v1/lab/results (Submit Result)
    API->>DB: Validate order.patientId == body.patientId, save LabResult, close LabOrder
    Doctor->>API: PATCH /api/v1/encounters/:id/status ('COMPLETED')

    Note over Billing,Patient: Phase 5: Billing, Invoicing & Consent Directives
    Billing->>API: POST /api/v1/billing/invoices (Generate Invoice)
    Patient->>API: POST /api/v1/billing/invoices/:id/pay
    Patient->>API: POST /api/v1/consents/:id/revoke (Revoke DATA_SHARING)
    API->>DB: UPDATE Consent status = 'REVOKED'
    Note over Doctor,API: Clinical Access Denied: Doctor queried for clinical notes -> 403 Forbidden
    Patient->>API: POST /api/v1/consents/:id/grant (Restore Access)
    API->>DB: UPDATE Consent status = 'GRANTED'
```

---

## 4. Assessment Traceability Matrix (MC-01 to MC-15)

| Assessment | Scope & Core Requirements | Primary Implementation Artifacts | Automated Tests & Verification |
| :--- | :--- | :--- | :--- |
| **MC-01** | Role-based Next.js 14 App Router UI (7 Dashboards: Patient, Receptionist, Doctor, Nurse, Lab, Billing, Admin) | `frontend/src/components/dashboards/*`, `frontend/src/app/*` | `frontend/tests/login.test.tsx`, `frontend/tests/ui_states.test.tsx`, `next build` |
| **MC-02** | Hospital RESTful Backend APIs (Versioning, pagination, RFC envelope) | `backend/src/app.ts`, `backend/src/routes/v1/index.ts`, `backend/src/controllers/*` | `backend/tests/workflows.test.ts`, `auth.test.ts` |
| **MC-03** | Clinical Relational Database (17 entities, foreign keys, constraints) | `backend/prisma/schema.prisma`, `backend/prisma/migrations/*` | `backend/tests/integration_postgres.test.ts` |
| **MC-04** | Clinical Data Security & RBAC (Admin clinical isolation, IDOR protection) | `backend/src/middlewares/clinicalAccess.ts`, `backend/src/middlewares/authorize.ts` | `backend/tests/authorization.test.ts`, `privacy_and_boundaries.test.ts` |
| **MC-05** | Python Clinical Processing (Units, normal ranges, anomaly detection) | `analytics/processor.py`, `analytics/samples/*` | `analytics/tests/test_analytics.py`, `analytics/benchmark_report.json` |
| **MC-06** | FastAPI Analytics (Utilization, wait-times, turnaround, population health) | `analytics/main.py`, `analytics/service.py`, `analytics/models.py` | `analytics/tests/test_analytics.py` (15/15 passed) |
| **MC-07** | Scheduling & Care Workflow Engine (Double-booking lock, duplicate checks) | `backend/src/services/appointmentService.ts`, `encounterService.ts` | `backend/tests/appointment_concurrency.test.ts`, `clinical_security.test.ts` |
| **MC-08** | Interoperability & Notification Worker (FHIR R4 resources, DLQ retry) | `analytics/fhir.py`, `analytics/worker.py`, `backend/src/controllers/fhirController.ts` | `analytics/tests/test_analytics.py`, `scripts/simulate_incidents.py` |
| **MC-09** | Non-root Containerization (Docker Compose, private subnets, health checks) | `docker-compose.yml`, `docker-compose.prod.yml`, `backend/Dockerfile` | Container validation script (`scripts/verify_all.ps1`) |
| **MC-10** | Code Review & Git Foundation (CODEOWNERS, checklists, PR templates) | `.github/CODEOWNERS`, `.github/pull_request_template.md`, `docs/*` | Git policy review validation |
| **MC-11** | Enterprise CI/CD Pipelines (Automated linting, secret checks, release) | `.github/workflows/ci.yml`, `.github/workflows/release.yml` | GitHub Actions workflow schema validation |
| **MC-12** | Privacy & Workflow Integration Tests (Collisions, consent, Playwright) | `backend/tests/clinical_security.test.ts`, `frontend/tests/e2e/*` | 46 backend tests + 14 frontend tests |
| **MC-13** | Complete API Documentation (Swagger OpenAPI 3.0.3 and Postman collection) | `backend/src/docs/swagger.json`, `docs/medicore_postman_collection.json` | Mounted at `/docs`, `/api/v1/docs`, `/openapi.json` |
| **MC-14** | Secure Hospital Deployment (Nginx HTTPS, backup/restore validation, contacts) | `docker/nginx.conf`, `scripts/backup_db.*`, `docs/INCIDENT_CONTACTS.md` | Verification scripts + SSL configuration |
| **MC-15** | Incident Simulation & Recovery (5 failure scenarios with captured evidence) | `scripts/simulate_incidents.py`, `docs/incident_simulation_evidence.json` | Automated simulation runner (5/5 passed) |
