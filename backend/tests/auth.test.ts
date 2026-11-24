import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import bcrypt from 'bcryptjs';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole } from '../src/constants/roles.js';

// Mock prisma for deterministic unit testing without external database
vi.mock('../src/prisma.js', () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      patient: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      refreshSession: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      auditRecord: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: vi.fn((callback) => callback(prisma)),
    },
    default: {
      user: { findUnique: vi.fn(), create: vi.fn() },
      auditRecord: { create: vi.fn() },
    },
  };
});

describe('Authentication & Input Validation', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects registration when email is invalid or password too weak (Zod validation)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'invalid-email',
        password: 'weak',
        firstName: '',
        lastName: 'Test',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  it('successfully registers a new user with valid inputs and hashes password', async () => {
    const mockUser = {
      id: 'user-uuid-1',
      email: 'newuser@medicore.local',
      firstName: 'New',
      lastName: 'User',
      role: 'PATIENT',
      passwordHash: 'hashed-secret',
    };

    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue(mockUser);
    (prisma.patient.create as any).mockResolvedValue({ id: 'pat-1', mrn: 'MC-2026-1234' });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@medicore.local',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('newuser@medicore.local');
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('rejects duplicate email registration with 409 Conflict', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'existing-id', email: 'dup@medicore.local' });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'dup@medicore.local',
        password: 'Password123!',
        firstName: 'Dup',
        lastName: 'User',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('authenticates user and returns JWT access and refresh tokens', async () => {
    const password = 'Password123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const mockUser = {
      id: 'user-uuid-doctor',
      email: 'dr.chen@medicore.local',
      passwordHash,
      role: UserRole.DOCTOR,
      firstName: 'Robert',
      lastName: 'Chen',
      isActive: true,
      patientProfile: null,
      providerProfile: { id: 'prov-1' },
      staffProfile: null,
    };

    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
    (prisma.refreshSession.create as any).mockResolvedValue({ id: 'session-1' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'dr.chen@medicore.local',
        password: 'Password123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.role).toBe(UserRole.DOCTOR);
  });

  it('detects refresh token reuse and revokes all active sessions for that user', async () => {
    const fakeToken = '1234567890abcdef1234567890abcdef';
    (prisma.refreshSession.findUnique as any).mockResolvedValue({
      id: 'session-old',
      userId: 'user-attacked',
      revokedAt: new Date(Date.now() - 3600000), // already revoked!
      expiresAt: new Date(Date.now() + 3600000),
      user: { id: 'user-attacked', email: 'test@medicore.local', role: UserRole.PATIENT },
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: fakeToken });

    expect(res.status).toBe(401);
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-attacked' },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
