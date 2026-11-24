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
      create: vi.fn(),
      update: vi.fn(),
    },
    labOrder: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    labResult: {
      create: vi.fn(),
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
});
