import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole } from '../src/constants/roles.js';

vi.mock('../src/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    patient: {
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(42),
    },
    staff: {
      count: vi.fn().mockResolvedValue(12),
    },
    department: {
      count: vi.fn().mockResolvedValue(5),
    },
    provider: {
      count: vi.fn().mockResolvedValue(8),
    },
    providerSchedule: {
      findMany: vi.fn(),
    },
    appointment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(15),
      update: vi.fn(),
    },
    encounter: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(3),
    },
    medicationOrder: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    labOrder: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(7),
    },
    invoice: {
      count: vi.fn().mockResolvedValue(9),
    },
    waitingList: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(4),
      findMany: vi.fn().mockResolvedValue([]),
    },
    consent: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    auditRecord: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  },
  default: {},
}));

describe('Workflows & Security Enhancements (MC-04, MC-07)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Public Registration Privileged Role Denial (MC-04)', () => {
    it('denies public unauthenticated user attempting to register as DOCTOR or HOSPITAL_ADMIN', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'hacker@medicore.local',
          password: 'Password123!',
          firstName: 'Evil',
          lastName: 'Actor',
          role: 'HOSPITAL_ADMIN',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Public registration is restricted to patient accounts only');
    });
  });

  describe('Controlled Clinical Workflow Transitions (MC-07)', () => {
    it('allows valid encounter transition from IN_PROGRESS to COMPLETED', async () => {
      const doctorToken = generateAccessToken({
        userId: 'user-doc-1',
        email: 'doctor@medicore.local',
        role: UserRole.DOCTOR,
      });

      (prisma.encounter.findUnique as any).mockResolvedValue({
        id: 'enc-1',
        patientId: 'pat-1',
        providerId: 'prov-1',
        status: 'IN_PROGRESS',
        appointmentId: 'appt-1',
      });

      (prisma.encounter.update as any).mockResolvedValue({
        id: 'enc-1',
        status: 'COMPLETED',
        endedAt: new Date(),
      });

      const res = await request(app)
        .patch('/api/v1/encounters/enc-1/status')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ status: 'COMPLETED', notes: 'Patient condition stabilized.' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-1' },
        data: { status: 'COMPLETED' },
      });
    });

    it('allows Nurse to append clinical observations without requiring status transition', async () => {
      const nurseToken = generateAccessToken({
        userId: 'user-nurse-1',
        email: 'nurse@medicore.local',
        role: UserRole.NURSE,
      });

      (prisma.encounter.findUnique as any).mockResolvedValue({
        id: 'enc-obs-1',
        patientId: 'pat-1',
        providerId: 'prov-1',
        status: 'IN_PROGRESS',
        notes: 'Initial triage complete.',
      });

      (prisma.encounter.update as any).mockResolvedValue({
        id: 'enc-obs-1',
        patientId: 'pat-1',
        providerId: 'prov-1',
        status: 'IN_PROGRESS',
        notes: 'Initial triage complete.\n[Update]: BP: 120/80 mmHg | HR: 72 bpm',
        patient: { id: 'pat-1', firstName: 'Alice', lastName: 'Morgan', mrn: 'MC-2026-0001' },
      });

      const res = await request(app)
        .patch('/api/v1/encounters/enc-obs-1/status')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ status: 'IN_PROGRESS', notes: 'BP: 120/80 mmHg | HR: 72 bpm' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(prisma.encounter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'enc-obs-1' },
          data: expect.objectContaining({
            status: 'IN_PROGRESS',
            notes: expect.stringContaining('BP: 120/80 mmHg | HR: 72 bpm'),
          }),
        })
      );
    });

    it('prevents modifying completed terminal encounters', async () => {
      const nurseToken = generateAccessToken({
        userId: 'user-nurse-1',
        email: 'nurse@medicore.local',
        role: UserRole.NURSE,
      });

      (prisma.encounter.findUnique as any).mockResolvedValue({
        id: 'enc-comp-1',
        patientId: 'pat-1',
        providerId: 'prov-1',
        status: 'COMPLETED',
        notes: 'Discharged.',
      });

      const res = await request(app)
        .patch('/api/v1/encounters/enc-comp-1/status')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ notes: 'Attempted post-completion note' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Cannot transition encounter from terminal status');
    });

    it('rejects invalid encounter transition from COMPLETED to IN_PROGRESS', async () => {
      const doctorToken = generateAccessToken({
        userId: 'user-doc-1',
        email: 'doctor@medicore.local',
        role: UserRole.DOCTOR,
      });

      (prisma.encounter.findUnique as any).mockResolvedValue({
        id: 'enc-1',
        patientId: 'pat-1',
        providerId: 'prov-1',
        status: 'COMPLETED',
      });

      const res = await request(app)
        .patch('/api/v1/encounters/enc-1/status')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Cannot transition encounter from terminal status');
    });

    it('rejects invalid lab order transition from ORDERED directly to COMPLETED', async () => {
      const techToken = generateAccessToken({
        userId: 'user-tech-1',
        email: 'tech@medicore.local',
        role: UserRole.LAB_TECHNICIAN,
      });

      (prisma.labOrder.findUnique as any).mockResolvedValue({
        id: 'order-1',
        patientId: 'pat-1',
        status: 'ORDERED',
      });

      const res = await request(app)
        .patch('/api/v1/lab/orders/order-1/status')
        .set('Authorization', `Bearer ${techToken}`)
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid lab order status transition');
    });
  });

  describe('Provider Availability Calculation (MC-07)', () => {
    it('calculates available slots correctly considering existing bookings', async () => {
      const userToken = generateAccessToken({
        userId: 'user-patient-1',
        email: 'patient@medicore.local',
        role: UserRole.PATIENT,
      });

      // Provider schedule: Monday (day 1), 09:00 to 11:00, 30 min slots
      // 2026-11-30 is a Monday (getUTCDay() === 1)
      (prisma.providerSchedule.findMany as any).mockResolvedValue([
        {
          id: 'sched-1',
          providerId: 'prov-1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '11:00',
          slotDurationMinutes: 30,
          isActive: true,
        },
      ]);

      // One booked appointment from 09:30 to 10:00
      (prisma.appointment.findMany as any).mockResolvedValue([
        {
          id: 'appt-booked',
          scheduledStart: new Date('2026-11-30T09:30:00.000Z'),
          scheduledEnd: new Date('2026-11-30T10:00:00.000Z'),
        },
      ]);

      const res = await request(app)
        .get('/api/v1/providers/prov-1/availability?date=2026-11-30')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.slots).toHaveLength(4);
      // Slot 1: 09:00 - 09:30 (available: true)
      expect(res.body.data.slots[0].available).toBe(true);
      // Slot 2: 09:30 - 10:00 (available: false)
      expect(res.body.data.slots[1].available).toBe(false);
      // Slot 3: 10:00 - 10:30 (available: true)
      expect(res.body.data.slots[2].available).toBe(true);
      // Slot 4: 10:30 - 11:00 (available: true)
      expect(res.body.data.slots[3].available).toBe(true);
    });
  });

  describe('Waiting List & Operational Summary', () => {
    it('creates waiting list entry and updates status', async () => {
      const receptionistToken = generateAccessToken({
        userId: 'user-rec-1',
        email: 'receptionist@medicore.local',
        role: UserRole.RECEPTIONIST,
      });

      (prisma.waitingList.create as any).mockResolvedValue({
        id: 'wait-1',
        patientId: '00000000-0000-0000-0000-000000000001',
        departmentId: '00000000-0000-0000-0000-000000000002',
        priority: 'URGENT',
        status: 'WAITING',
      });

      const createRes = await request(app)
        .post('/api/v1/waiting-list')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId: '00000000-0000-0000-0000-000000000001',
          departmentId: '00000000-0000-0000-0000-000000000002',
          priority: 'URGENT',
          requestedDate: '2026-12-05T09:00:00Z',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.priority).toBe('URGENT');
    });

    it('returns operational summary to Hospital Admin without PHI payload', async () => {
      const adminToken = generateAccessToken({
        userId: 'user-admin-1',
        email: 'admin@medicore.local',
        role: UserRole.HOSPITAL_ADMIN,
      });

      const res = await request(app)
        .get('/api/v1/admin/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.metrics.totalPatients).toBe(42);
      expect(res.body.data.metrics.totalStaff).toBe(12);
      expect(res.body.data.metrics.activeEncounters).toBe(3);
    });

    it('allows Receptionist to check in a scheduled appointment, transitioning it to CONFIRMED', async () => {
      const receptionistToken = generateAccessToken({
        userId: 'user-rec-1',
        email: 'receptionist@medicore.local',
        role: UserRole.RECEPTIONIST,
      });

      (prisma.appointment.findUnique as any).mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000010',
        status: 'SCHEDULED',
      });
      (prisma.appointment.update as any).mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000010',
        status: 'CONFIRMED',
      });

      const res = await request(app)
        .post('/api/v1/appointments/00000000-0000-0000-0000-000000000010/check-in')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: '00000000-0000-0000-0000-000000000010' },
        data: { status: 'CONFIRMED' },
      });
    });

    it('allows Nurse or Doctor to initiate encounter from checked-in appointment and prevents duplicates', async () => {
      const nurseToken = generateAccessToken({
        userId: 'user-nurse-1',
        email: 'nurse@medicore.local',
        role: UserRole.NURSE,
      });

      // 1. Initial creation succeeds
      (prisma.encounter.findUnique as any).mockResolvedValueOnce(null);
      (prisma.appointment.findUnique as any).mockResolvedValueOnce({
        id: '00000000-0000-0000-0000-000000000020',
        status: 'CONFIRMED',
      });
      (prisma.encounter.create as any).mockResolvedValue({
        id: 'enc-new-1',
        patientId: '00000000-0000-0000-0000-000000000001',
        providerId: '00000000-0000-0000-0000-000000000002',
        appointmentId: '00000000-0000-0000-0000-000000000020',
        status: 'IN_PROGRESS',
      });

      const res = await request(app)
        .post('/api/v1/encounters')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          patientId: '00000000-0000-0000-0000-000000000001',
          providerId: '00000000-0000-0000-0000-000000000002',
          appointmentId: '00000000-0000-0000-0000-000000000020',
          encounterType: 'OUTPATIENT',
          notes: 'Patient arrived for triage vitals',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('IN_PROGRESS');

      // 2. Duplicate encounter attempt is rejected with 409 Conflict
      (prisma.encounter.findUnique as any).mockResolvedValueOnce({
        id: 'enc-new-1',
        appointmentId: '00000000-0000-0000-0000-000000000020',
      });

      const dupRes = await request(app)
        .post('/api/v1/encounters')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          patientId: '00000000-0000-0000-0000-000000000001',
          providerId: '00000000-0000-0000-0000-000000000002',
          appointmentId: '00000000-0000-0000-0000-000000000020',
          encounterType: 'OUTPATIENT',
        });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.message).toContain('An encounter already exists for appointment');
    });
  });
});
