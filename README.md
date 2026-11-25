# MediCore — Integrated Hospital Management Platform

MediCore is an enterprise-grade, integrated hospital management and clinical information system built with a zero-trust security architecture, strict clinical data privacy, non-diagnostic analytics, and healthcare interoperability.

---

## Architecture Diagram (MC-14)

```mermaid
flowchart TD
    subgraph Public_Perimeter["Public Perimeter / Host Network"]
        ClientBrowser["Web Browser (Patient / Clinician / Admin)"]
        NginxProxy["Nginx HTTPS Reverse Proxy (Port 80/443)"]
    end

    subgraph DMZ_Services["MediCore Application Services"]
        Frontend["Next.js 14 Web Frontend\n(Port 3002)\nReact 18 • Tailwind • TanStack Query"]
        BackendGateway["Express TypeScript API Gateway\n(Port 4002)\nPrisma ORM • RBAC • Audit Engine"]
        AnalyticsSvc["FastAPI Clinical Analytics\n(Port 8002)\nPython 3.11 • FHIR R4 Mock"]
    end

    subgraph Internal_Private["Private Internal Network (No Host Exposure)"]
        PostgresDB[("PostgreSQL 16 Alpine\nClinical Relational Store\n17 Entities • BTree_GiST Locks")]
        RedisCache[("Redis 7 Alpine\nSession Invalidation\nIdempotent Notification Queue")]
        WorkerSvc["Dedicated Notification Worker\nPython Daemon • DLQ Recovery"]
    end

    ClientBrowser -->|HTTP/HTTPS| NginxProxy
    NginxProxy -->|Proxy /| Frontend
    NginxProxy -->|Proxy /api/v1| BackendGateway
    Frontend -->|REST APIs| BackendGateway
    BackendGateway -->|Internal RPC| AnalyticsSvc
    BackendGateway -->|Authoritative Query| PostgresDB
    BackendGateway -->|Token Cache / Publish| RedisCache
    WorkerSvc -->|Pop / Deduplicate| RedisCache
    AnalyticsSvc -->|Read-Only Stats| BackendGateway
```

---

## Relational Entity-Relationship Diagram (MC-03)

```mermaid
erDiagram
    USER ||--o{ REFRESH_SESSION : maintains
    USER ||--o| PATIENT : identifies
    USER ||--o| STAFF : employs
    USER ||--o{ AUDIT_RECORD : triggers
    
    STAFF ||--o| PROVIDER : includes
    DEPARTMENT ||--o{ PROVIDER : contains
    PROVIDER ||--o{ PROVIDER_SCHEDULE : publishes
    
    PATIENT ||--o{ APPOINTMENT : books
    PROVIDER ||--o{ APPOINTMENT : hosts
    PATIENT ||--o{ WAITING_LIST : queued_in
    
    PATIENT ||--o{ ENCOUNTER : attends
    PROVIDER ||--o{ ENCOUNTER : conducts
    
    ENCOUNTER ||--o{ DIAGNOSIS : records
    ENCOUNTER ||--o{ MEDICATION_ORDER : prescribes
    ENCOUNTER ||--o{ LAB_ORDER : requests
    
    LAB_ORDER ||--o| LAB_RESULT : yields
    PATIENT ||--o{ INVOICE : billed
    PATIENT ||--o{ CONSENT : authorizes
```

---

## 15 Assessment Matrix & Requirement Traceability

| Assessment ID | Description | Technology Stack | Status |
| :--- | :--- | :--- | :--- |
| **MC-01** | Healthcare role-based frontend | Next.js 14 App Router, TypeScript, Tailwind | **Completed** |
| **MC-02** | Hospital Backend APIs | Node.js 22, Express, TypeScript | **Completed** |
| **MC-03** | Clinical Relational Database | PostgreSQL 16, Prisma ORM (17 Entities) | **Completed** |
| **MC-04** | Clinical Data Security & RBAC | 7 Granular Roles, Default-Deny, Admin Isolation | **Completed** |
| **MC-05** | Python clinical data processing | Python 3.11, Unit & Range Validators, Benchmarks | **Completed** |
| **MC-06** | FastAPI clinical analytics | FastAPI, Non-Diagnostic Metrics, SLA Compliance | **Completed** |
| **MC-07** | Appointment & care workflow engine | Concurrency locks, Overlap exclusion, FSM state engine | **Completed** |
| **MC-08** | Healthcare interoperability | HL7 FHIR R4 Mock (Patient/Obs), Idempotent Worker | **Completed** |
| **MC-09** | Containerized Docker foundation | Docker Compose, Non-root containers, Healthchecks | **Completed** |
| **MC-10** | Local Git & change review | CODEOWNERS, PR templates, Clinical checklists | **Completed** |
| **MC-11** | CI/CD automated pipeline | GitHub Actions (Build, Test, Scan, Release) | **Completed** |
| **MC-12** | Privacy & workflow testing | Supertest integration tests & Playwright E2E specs | **Completed** |
| **MC-13** | Complete API documentation | OpenAPI 3.0 / Swagger UI (`/docs`), Postman Collection | **Completed** |
| **MC-14** | Secure hospital deployment | Production Compose, Nginx SSL proxy, Backups | **Completed** |
| **MC-15** | Incident simulation & recovery | Reproducible incident scripts, Recovery runbooks | **Completed** |

---

## Verification & Startup Commands

### Run Services Locally

```powershell
# 1. Start Backend API (Port 4002)
cd backend
npm run dev

# 2. Start Frontend Web Portal (Port 3002)
cd frontend
npm run dev

# 3. Start Clinical Analytics Microservice (Port 8002)
python -m uvicorn analytics.main:app --port 8002 --reload

# 4. Start Notification Worker Daemon
python -m analytics.worker_daemon
```

### Run Automated Test Suites

```powershell
# Run Backend Integration & Security Tests (24 tests)
cd backend
npm test

# Run Frontend React Testing Library Tests (8 tests)
cd frontend
npm test

# Run Python Analytics & FHIR Interoperability Tests (13 tests)
python -m pytest analytics/tests -v

# Run Incident Simulation Suite (MC-15)
python scripts/simulate_incidents.py
```
