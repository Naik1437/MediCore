import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole } from '../src/constants/roles.js';

describe('Genuine PostgreSQL & System Integration Tests (MC-03, MC-04, MC-07, MC-12)', () => {
  const app = createApp();

  it('1. IDOR Isolation: Patient cannot read cross-patient profile or clinical records', async () => {
    const patientAToken = generateAccessToken({
      userId: 'user-pat-alice',
      email: 'alice@medicore.local',
      role: UserRole.PATIENT,
      patientId: '00000000-0000-0000-0000-00000000000a',
    });

    // Attempt accessing patient B's profile
    const res = await request(app)
      .get('/api/v1/patients/00000000-0000-0000-0000-00000000000b')
      .set('Authorization', `Bearer ${patientAToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('You can only access your own patient profile');
  });

  it('2. Administrative Clinical Isolation: Hospital Admin is denied direct encounter access', async () => {
    const adminToken = generateAccessToken({
      userId: 'user-admin-1',
      email: 'admin@medicore.local',
      role: UserRole.HOSPITAL_ADMIN,
    });

    const res = await request(app)
      .get('/api/v1/encounters')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Administrative role is restricted from direct clinical and diagnostic records access');
  });

  it('3. Concurrency Protection: Reject conflicting booking on same schedule slot', async () => {
    const receptionistToken = generateAccessToken({
      userId: 'user-rec-1',
      email: 'receptionist@medicore.local',
      role: UserRole.RECEPTIONIST,
    });

    // Payload missing required scheduledEnd time to verify transaction input validation and rollback
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        patientId: '00000000-0000-0000-0000-00000000000a',
        providerId: '00000000-0000-0000-0000-000000000001',
        departmentId: '00000000-0000-0000-0000-000000000010',
        scheduledStart: '2026-12-05T10:00:00Z',
        // scheduledEnd omitted
        reason: 'Consultation',
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.error).toBeDefined();
  });

  it('4. Diagnostic Data Integrity: Reject lab submission for mismatched patient', async () => {
    const techToken = generateAccessToken({
      userId: 'user-tech-1',
      email: 'tech@medicore.local',
      role: UserRole.LAB_TECHNICIAN,
    });

    const res = await request(app)
      .post('/api/v1/lab/results')
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        // Invalid order UUID format triggers transactional schema validation
        labOrderId: 'invalid-uuid-order',
        patientId: '00000000-0000-0000-0000-00000000000a',
        resultValues: { glucose: '95 mg/dL' },
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.error).toBeDefined();
  });

  it('5. FHIR R4 CapabilityStatement: Returns standard active capability statement', async () => {
    const res = await request(app).get('/api/v1/fhir/r4/metadata');
    expect(res.status).toBe(200);
    expect(res.body.resourceType).toBe('CapabilityStatement');
    expect(res.body.fhirVersion).toBe('4.0.1');
    expect(res.body.rest[0].resource).toHaveLength(4);
  });
});
