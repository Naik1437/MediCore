import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole } from '../src/constants/roles.js';

vi.mock('../src/prisma.js', () => ({
  prisma: {
    patient: {
      findUnique: vi.fn(),
    },
    consent: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    labOrder: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    labResult: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    encounter: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    diagnosis: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    medicationOrder: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    auditRecord: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
  default: {},
}));

describe('Clinical Security, IDOR, Consent & Lab Integrity', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.consent.findFirst as any).mockResolvedValue(null);
    (prisma.diagnosis.findFirst as any).mockResolvedValue(null);
    (prisma.labResult.findFirst as any).mockResolvedValue(null);
    (prisma.labOrder.findFirst as any).mockResolvedValue(null);
  });

  it('prevents IDOR: Patient A cannot read Patient B patient profile', async () => {
    const patientAToken = generateAccessToken({
      userId: 'user-pat-a',
      email: 'alice@medicore.local',
      role: UserRole.PATIENT,
      patientId: 'patient-uuid-alice',
    });

    const res = await request(app)
      .get('/api/v1/patients/patient-uuid-benjamin')
      .set('Authorization', `Bearer ${patientAToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('You can only access your own patient profile');
  });

  it('enforces Consent Revocation: blocks clinical access when consent is REVOKED', async () => {
    const doctorToken = generateAccessToken({
      userId: 'user-doc-1',
      email: 'doctor@medicore.local',
      role: UserRole.DOCTOR,
    });

    // Mock patient having revoked data sharing consent
    (prisma.consent.findFirst as any).mockResolvedValue({
      id: 'consent-1',
      patientId: 'patient-uuid-1',
      status: 'REVOKED',
    });

    const res = await request(app)
      .get('/api/v1/encounters?patientId=patient-uuid-1')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Clinical access denied: Patient has revoked data-sharing consent');
  });

  it('CRITICAL MC-07: rejects lab result submission when patientId does not match lab order', async () => {
    const labTechToken = generateAccessToken({
      userId: 'user-tech-1',
      email: 'labtech@medicore.local',
      role: UserRole.LAB_TECHNICIAN,
    });

    // Mock lab order belongs to Patient A
    (prisma.labOrder.findUnique as any).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      patientId: '00000000-0000-0000-0000-00000000000a',
      status: 'ORDERED',
    });

    // Technician mistakenly submits result for Patient B
    const res = await request(app)
      .post('/api/v1/lab/results')
      .set('Authorization', `Bearer ${labTechToken}`)
      .send({
        labOrderId: '00000000-0000-0000-0000-000000000001',
        patientId: '00000000-0000-0000-0000-00000000000b',
        resultValues: { glucose: '110 mg/dL' },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Integrity violation: The specified patient does not match');
    expect(prisma.labResult.create).not.toHaveBeenCalled();
  });

  it('successfully records ICD-10 diagnosis (I10 Essential hypertension) for an in-progress encounter', async () => {
    (prisma.consent.findFirst as any).mockResolvedValue(null);

    const doctorToken = generateAccessToken({
      userId: 'user-doc-1',
      email: 'doctor@medicore.local',
      role: UserRole.DOCTOR,
    });

    (prisma.encounter.findUnique as any).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000010',
      patientId: '00000000-0000-0000-0000-000000000001',
      providerId: '00000000-0000-0000-0000-000000000002',
      status: 'IN_PROGRESS',
    });

    (prisma.diagnosis.create as any).mockResolvedValue({
      id: 'diag-1',
      encounterId: '00000000-0000-0000-0000-000000000010',
      patientId: '00000000-0000-0000-0000-000000000001',
      providerId: '00000000-0000-0000-0000-000000000002',
      icdCode: 'I10',
      description: 'Essential (primary) hypertension',
      type: 'PRIMARY',
    });

    const res = await request(app)
      .post('/api/v1/encounters/00000000-0000-0000-0000-000000000010/diagnoses')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: '00000000-0000-0000-0000-000000000001',
        providerId: '00000000-0000-0000-0000-000000000002',
        icdCode: 'I10',
        description: 'Essential (primary) hypertension',
        type: 'PRIMARY',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.icdCode).toBe('I10');
    expect(res.body.data.description).toBe('Essential (primary) hypertension');
  });

  it('successfully creates medication order with encounterId from URL or body', async () => {
    (prisma.consent.findFirst as any).mockResolvedValue(null);

    const doctorToken = generateAccessToken({
      userId: 'user-doc-1',
      email: 'doctor@medicore.local',
      role: UserRole.DOCTOR,
    });

    (prisma.encounter.findUnique as any).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000010',
      patientId: '00000000-0000-0000-0000-000000000001',
      providerId: '00000000-0000-0000-0000-000000000002',
      status: 'IN_PROGRESS',
    });

    (prisma.medicationOrder.create as any).mockResolvedValue({
      id: 'rx-1',
      encounterId: '00000000-0000-0000-0000-000000000010',
      medicationName: 'Amlodipine 5mg',
      dosage: '5mg daily',
      frequency: 'Once daily',
      duration: '30 days',
      status: 'ACTIVE',
    });

    const res = await request(app)
      .post('/api/v1/encounters/00000000-0000-0000-0000-000000000010/prescriptions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: '00000000-0000-0000-0000-000000000001',
        providerId: '00000000-0000-0000-0000-000000000002',
        medicationName: 'Amlodipine 5mg',
        dosage: '5mg daily',
        frequency: 'Once daily',
        duration: '30 days',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.medicationName).toBe('Amlodipine 5mg');
  });

  it('blocks doctor direct access to patient prescriptions when consent is REVOKED', async () => {
    const doctorToken = generateAccessToken({
      userId: 'user-doc-1',
      email: 'doctor@medicore.local',
      role: UserRole.DOCTOR,
    });

    (prisma.consent.findFirst as any).mockResolvedValue({
      id: 'consent-revoked-1',
      patientId: 'patient-uuid-1',
      status: 'REVOKED',
    });

    const res = await request(app)
      .get('/api/v1/prescriptions/patient/patient-uuid-1')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Clinical access denied: Patient has revoked data-sharing consent');
  });

  it('blocks doctor diagnosis submission when patient consent is REVOKED', async () => {
    const doctorToken = generateAccessToken({
      userId: 'user-doc-1',
      email: 'doctor@medicore.local',
      role: UserRole.DOCTOR,
    });

    (prisma.encounter.findUnique as any).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000010',
      patientId: 'patient-uuid-1',
      providerId: '00000000-0000-0000-0000-000000000002',
      status: 'IN_PROGRESS',
    });

    (prisma.consent.findFirst as any).mockResolvedValue({
      id: 'consent-revoked-1',
      patientId: 'patient-uuid-1',
      status: 'REVOKED',
    });

    const res = await request(app)
      .post('/api/v1/encounters/00000000-0000-0000-0000-000000000010/diagnoses')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: 'patient-uuid-1',
        providerId: '00000000-0000-0000-0000-000000000002',
        icdCode: 'I10',
        description: 'Essential (primary) hypertension',
        type: 'PRIMARY',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Clinical access denied: Patient has revoked data-sharing consent');
    expect(prisma.diagnosis.create).not.toHaveBeenCalled();
  });

  it('preserves patient self-access to prescriptions even when data-sharing consent is REVOKED', async () => {
    const patientToken = generateAccessToken({
      userId: 'user-pat-1',
      email: 'patient@medicore.local',
      role: UserRole.PATIENT,
      patientId: 'patient-uuid-1',
    });

    (prisma.consent.findFirst as any).mockResolvedValue({
      id: 'consent-revoked-1',
      patientId: 'patient-uuid-1',
      status: 'REVOKED',
    });

    (prisma.medicationOrder.findMany as any).mockResolvedValue([
      {
        id: 'rx-1',
        patientId: 'patient-uuid-1',
        medicationName: 'Metformin 500mg',
        dosage: '500mg',
        status: 'ACTIVE',
      },
    ]);

    const res = await request(app)
      .get('/api/v1/prescriptions/patient/patient-uuid-1')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].medicationName).toBe('Metformin 500mg');
  });

  it('allows patient to grant access and restore consent directive', async () => {
    const patientToken = generateAccessToken({
      userId: 'user-pat-1',
      email: 'patient@medicore.local',
      role: UserRole.PATIENT,
      patientId: 'patient-uuid-1',
    });

    (prisma.consent.findUnique as any).mockResolvedValue({
      id: 'consent-to-grant',
      patientId: 'patient-uuid-1',
      consentType: 'DATA_SHARING',
      status: 'REVOKED',
    });

    (prisma.consent.update as any).mockResolvedValue({
      id: 'consent-to-grant',
      patientId: 'patient-uuid-1',
      consentType: 'DATA_SHARING',
      status: 'GRANTED',
      revokedAt: null,
    });

    const res = await request(app)
      .post('/api/v1/consents/consent-to-grant/grant')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('GRANTED');
    expect(prisma.consent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'consent-to-grant' },
        data: expect.objectContaining({ status: 'GRANTED', revokedAt: null }),
      })
    );
  });

  it('prevents IDOR: Patient B cannot restore Patient A consent directive', async () => {
    const patientBToken = generateAccessToken({
      userId: 'user-pat-2',
      email: 'bob@medicore.local',
      role: UserRole.PATIENT,
      patientId: 'patient-uuid-2',
    });

    (prisma.consent.findUnique as any).mockResolvedValue({
      id: 'consent-a',
      patientId: 'patient-uuid-1',
      consentType: 'DATA_SHARING',
      status: 'REVOKED',
    });

    const res = await request(app)
      .post('/api/v1/consents/consent-a/grant')
      .set('Authorization', `Bearer ${patientBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Patients can only restore their own consent directives');
    expect(prisma.consent.update).not.toHaveBeenCalled();
  });

  it('rejects duplicate diagnosis submission on the same encounter', async () => {
    const doctorToken = generateAccessToken({
      userId: 'user-doc-1',
      email: 'doctor@medicore.local',
      role: UserRole.DOCTOR,
    });

    (prisma.encounter.findUnique as any).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000010',
      patientId: '00000000-0000-0000-0000-000000000001',
      providerId: '00000000-0000-0000-0000-000000000002',
      status: 'IN_PROGRESS',
    });

    // Mock existing diagnosis with identical icdCode
    (prisma.diagnosis.findFirst as any).mockResolvedValue({
      id: 'diag-existing',
      encounterId: '00000000-0000-0000-0000-000000000010',
      icdCode: 'I10',
    });

    const res = await request(app)
      .post('/api/v1/encounters/00000000-0000-0000-0000-000000000010/diagnoses')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: '00000000-0000-0000-0000-000000000001',
        providerId: '00000000-0000-0000-0000-000000000002',
        icdCode: 'I10',
        description: 'Essential (primary) hypertension',
        type: 'PRIMARY',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('already recorded for this encounter');
    expect(prisma.diagnosis.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate laboratory result submission for an already reported order', async () => {
    const labTechToken = generateAccessToken({
      userId: 'user-tech-1',
      email: 'labtech@medicore.local',
      role: UserRole.LAB_TECHNICIAN,
    });

    (prisma.labOrder.findUnique as any).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      patientId: '00000000-0000-0000-0000-00000000000a',
      status: 'IN_PROGRESS',
    });

    // Mock existing lab result
    (prisma.labResult.findFirst as any).mockResolvedValue({
      id: 'result-existing',
      labOrderId: '00000000-0000-0000-0000-000000000001',
    });

    const res = await request(app)
      .post('/api/v1/lab/results')
      .set('Authorization', `Bearer ${labTechToken}`)
      .send({
        labOrderId: '00000000-0000-0000-0000-000000000001',
        patientId: '00000000-0000-0000-0000-00000000000a',
        resultValues: { glucose: '115 mg/dL' },
      });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('laboratory result has already been submitted');
    expect(prisma.labResult.create).not.toHaveBeenCalled();
  });
});
