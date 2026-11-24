# MediCore — Enterprise Hospital Management Platform

MediCore is an integrated, modular hospital management platform designed for enterprise healthcare operations, clinical workflows, and data security.

## Platform Architecture

```
MediCore/
├── backend/                  # Node.js 22 + Express + TypeScript API (Port 4002)
│   ├── prisma/               # Schema, migrations, and synthetic seed generator
│   ├── src/
│   │   ├── config/           # Environment configuration
│   │   ├── constants/        # Roles (7 roles) and access matrices
│   │   ├── controllers/      # REST API controllers
│   │   ├── docs/             # OpenAPI 3.0 / Swagger specifications
│   │   ├── middlewares/      # RBAC, clinical isolation, IDOR, audit, error handler
│   │   ├── routes/           # Versioned API routes (/api/v1)
│   │   ├── services/         # Business logic & concurrency-safe services
│   │   └── utils/            # JWT, bcrypt, sanitizing logger, pagination
│   └── tests/                # Automated test suite (Vitest + Supertest)
├── frontend/                 # Web Portal placeholder (Port 3002 - Batch 2)
├── analytics/                # Clinical Analytics placeholder (Port 8002 - Batch 3)
├── docs/                     # Platform documentation & 15 Assessment Matrix
├── .github/workflows/        # CI/CD pipeline (GitHub Actions)
└── docker-compose.yml        # Multi-service isolated container environment
```

## Security & Access Control

MediCore enforces a zero-trust, default-deny security model:

1. **Seven Distinct Roles**:
   - `PATIENT`: Can only access their own appointments, invoices, lab results, and consents (IDOR protected).
   - `RECEPTIONIST`: Patient registration, appointment scheduling, waiting list management.
   - `DOCTOR`: Clinical encounters, diagnoses, prescriptions, lab orders.
   - `NURSE`: Vitals, clinical encounters, lab orders.
   - `LAB_TECHNICIAN`: Diagnostic order processing and lab result recording.
   - `BILLING_OFFICER`: Invoicing, payments, and account reconciliation.
   - `HOSPITAL_ADMIN`: System administration, staff, departments, audit logs. **Administrators are strictly prohibited from unrestricted access to clinical records.**

2. **Concurrency & Data Integrity**:
   - Provider appointment overlap is prevented via PostgreSQL `btree_gist` exclusion constraints (`appointment_no_overlap`) and transactional locks.
   - Lab result submissions strictly enforce foreign key matching between `labOrder.patientId` and `labResult.patientId`.

3. **Audit Logging & PHI Sanitization**:
   - Access attempts, denied permissions, and sensitive modifications are logged asynchronously.
   - Passwords, JWT tokens, and authorization headers are sanitized and masked as `[REDACTED]`.

---

## Getting Started

### Prerequisites
- Node.js 22+
- Docker & Docker Compose (or local PostgreSQL 16 + Redis 7)

### Environment Configuration
Copy the template configuration:
```bash
cp .env.example .env
```

### Running with Docker Compose
```bash
docker compose up -d --build
```
- API: `http://localhost:4002/api/v1`
- Swagger Docs: `http://localhost:4002/docs`
- Health Liveness: `http://localhost:4002/api/v1/health/live`
- Health Readiness: `http://localhost:4002/api/v1/health/ready`

### Running Locally without Docker

1. **Install backend dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Generate Prisma client & run migrations**:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

3. **Seed synthetic data**:
   ```bash
   npm run prisma:seed
   ```

4. **Build TypeScript**:
   ```bash
   npm run build
   ```

5. **Run automated tests**:
   ```bash
   npm test
   ```

6. **Start development server**:
   ```bash
   npm run dev
   ```

---

## Synthetic Development Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| `HOSPITAL_ADMIN` | `admin@medicore.local` | `Password123!` |
| `DOCTOR` | `doctor@medicore.local` | `Password123!` |
| `NURSE` | `nurse@medicore.local` | `Password123!` |
| `RECEPTIONIST` | `receptionist@medicore.local` | `Password123!` |
| `LAB_TECHNICIAN` | `labtech@medicore.local` | `Password123!` |
| `BILLING_OFFICER` | `billing@medicore.local` | `Password123!` |
| `PATIENT` | `patient@medicore.local` | `Password123!` |
