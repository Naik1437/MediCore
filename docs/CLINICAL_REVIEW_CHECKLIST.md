# MediCore Clinical Review & Git Governance Policy (MC-10)

## 1. Protected Branch Model
- **`main`**: Production-ready, fully verified codebase. Direct pushes are strictly prohibited.
- **`develop`**: Integration branch for completed batches and verified feature branches.
- **Branch Protection Rules**:
  - Minimum of 2 peer reviews required for merge approval.
  - At least 1 review must come from a designated `@medicore/security-officers` member for any auth, role, or middleware changes.
  - All automated CI/CD checks (unit tests, static analysis, container builds, migration checks) must pass before merging.
  - Enforce linear git history and require signed commits (`git commit -S`).

## 2. Clinical Change Review Checklists

### A. Access Control & Clinical Boundary Review
1. Does the PR modify any endpoint in `/api/v1`? If yes, verify `authenticate` and `requireRoles(...)` middleware are present.
2. Does the PR allow `HOSPITAL_ADMIN` to query encounters, diagnoses, vitals, or lab records? **If yes, reject immediately.**
3. Does the PR involve patient-facing endpoints? Confirm that `req.user.patientProfile.id === targetId` is enforced server-side.
4. If consent is revoked (`consent.status === 'REVOKED'`), does the system block clinical data return?

### B. Database Migration Review
1. Does the migration include destructive operations (`DROP TABLE`, `DROP COLUMN`)? Destructive operations require a two-phase rollout with deprecation notices.
2. Are all foreign key constraints paired with indexing?
3. Is `btree_gist` or equivalent overlap protection maintained for provider scheduling tables?

### C. Clinical Analytics Review (MC-05, MC-06)
1. Verify that all statistical metrics are aggregate only.
2. Ensure that no individual predictive diagnostic recommendations are outputted.
3. Confirm that the mandatory non-diagnostic disclaimer notice is included in JSON responses.
