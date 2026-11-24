import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';
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
  },
  default: {},
}));

describe('Authorization Boundaries & RBAC', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces default deny: unauthenticated requests receive 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/patients');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects receptionist attempting to access clinical encounters with 403 Forbidden', async () => {
    const receptionistToken = generateAccessToken({
      userId: 'user-rec-1',
      email: 'receptionist@medicore.local',
      role: UserRole.RECEPTIONIST,
    });

    const res = await request(app)
      .get('/api/v1/encounters')
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('CRITICAL MC-04: denies Hospital Administrator from direct clinical encounter records', async () => {
    const adminToken = generateAccessToken({
      userId: 'user-admin-1',
      email: 'admin@medicore.local',
      role: UserRole.HOSPITAL_ADMIN,
    });

    const res = await request(app)
      .get('/api/v1/encounters')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('Administrative role is restricted from direct clinical and diagnostic records access');
  });

  it('allows authorized Doctor to view encounters', async () => {
    const doctorToken = generateAccessToken({
      userId: 'user-doc-1',
      email: 'doctor@medicore.local',
      role: UserRole.DOCTOR,
    });

    (prisma.encounter.count as any).mockResolvedValue(0);
    (prisma.encounter.findMany as any).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/encounters')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
