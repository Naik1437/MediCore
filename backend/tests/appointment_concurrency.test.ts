import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole } from '../src/constants/roles.js';

vi.mock('../src/prisma.js', () => ({
  prisma: {
    appointment: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    auditRecord: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn(async (callback) => {
      return callback(prisma);
    }),
  },
  default: {},
}));

describe('Appointment Concurrency & Overlap Protection (MC-07)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects overlapping appointment booking with 409 Conflict', async () => {
    const receptionistToken = generateAccessToken({
      userId: 'user-rec-1',
      email: 'receptionist@medicore.local',
      role: UserRole.RECEPTIONIST,
    });

    const providerId = '11111111-1111-1111-1111-111111111111';
    const patientId = '22222222-2222-2222-2222-222222222222';
    const departmentId = '33333333-3333-3333-3333-333333333333';

    // Mock an existing appointment at the same slot
    (prisma.appointment.findFirst as any).mockResolvedValue({
      id: 'existing-appt-id',
      providerId,
      scheduledStart: new Date('2026-12-01T10:00:00Z'),
      scheduledEnd: new Date('2026-12-01T10:30:00Z'),
      status: 'SCHEDULED',
    });

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        providerId,
        patientId,
        departmentId,
        scheduledStart: '2026-12-01T10:15:00Z',
        scheduledEnd: '2026-12-01T10:45:00Z',
        reason: 'Overlapping consultation request',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain('already booked during this time interval');
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('successfully books when no overlap exists', async () => {
    const receptionistToken = generateAccessToken({
      userId: 'user-rec-1',
      email: 'receptionist@medicore.local',
      role: UserRole.RECEPTIONIST,
    });

    const providerId = '11111111-1111-1111-1111-111111111111';
    const patientId = '22222222-2222-2222-2222-222222222222';
    const departmentId = '33333333-3333-3333-3333-333333333333';

    (prisma.appointment.findFirst as any).mockResolvedValue(null);
    (prisma.appointment.create as any).mockResolvedValue({
      id: 'new-appt-123',
      providerId,
      patientId,
      scheduledStart: new Date('2026-12-01T14:00:00Z'),
      scheduledEnd: new Date('2026-12-01T14:30:00Z'),
      status: 'SCHEDULED',
    });

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        providerId,
        patientId,
        departmentId,
        scheduledStart: '2026-12-01T14:00:00Z',
        scheduledEnd: '2026-12-01T14:30:00Z',
        reason: 'General checkup',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(prisma.appointment.create).toHaveBeenCalled();
  });
});
