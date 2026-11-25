import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole } from '../src/constants/roles.js';

vi.mock('../src/prisma.js', () => ({
  prisma: {
    encounter: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    consent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    auditRecord: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    appointment: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    }
  },
  default: {},
}));

describe('MC-12: Privacy, Consent & Boundary Integration Tests', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const patientToken = generateAccessToken({
    userId: 'test-patient-user-01',
    email: 'patient1@medicore.local',
    role: UserRole.PATIENT,
    patientId: 'patient-uuid-01'
  });

  const adminToken = generateAccessToken({
    userId: 'test-admin-user-01',
    email: 'admin@medicore.local',
    role: UserRole.HOSPITAL_ADMIN
  });

  const doctorToken = generateAccessToken({
    userId: 'test-doctor-user-01',
    email: 'doctor@medicore.local',
    role: UserRole.DOCTOR,
    providerId: 'provider-uuid-01'
  });

  const receptionistToken = generateAccessToken({
    userId: 'test-receptionist-user-01',
    email: 'receptionist@medicore.local',
    role: UserRole.RECEPTIONIST
  });

  it('CRITICAL MC-04 / MC-12: Enforces Default Deny on unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/patients');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('CRITICAL MC-04 / MC-12: Hospital Administrator is strictly denied access to clinical encounters', async () => {
    const res = await request(app)
      .get('/api/v1/encounters')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('CRITICAL MC-04 / MC-12: Receptionist cannot access clinical encounters', async () => {
    const res = await request(app)
      .get('/api/v1/encounters')
      .set('Authorization', `Bearer ${receptionistToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('CRITICAL MC-04 / MC-12: Public registration denies privileged roles by default', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'attacker@medicore.local',
        password: 'Password123!',
        firstName: 'Malicious',
        lastName: 'User',
        role: 'DOCTOR' // Privileged role requested publicly
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('MC-08 / MC-12: Rejects malformed login inputs gracefully without crashing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'not-an-email',
        password: '123'
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
