import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordAudit } from '../src/services/auditService.js';
import { sanitize } from '../src/utils/logger.js';
import { prisma } from '../src/prisma.js';

vi.mock('../src/prisma.js', () => ({
  prisma: {
    auditRecord: {
      create: vi.fn().mockResolvedValue({ id: 'audit-log-uuid' }),
    },
  },
  default: {},
}));

describe('Audit Logging & Redaction (MC-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts sensitive credentials, tokens, and passwords from payloads', () => {
    const rawPayload = {
      email: 'doctor@medicore.local',
      password: 'SuperSecretPassword123!',
      token: 'jwt-token-string',
      refreshToken: 'refresh-token-string',
      nested: {
        authorization: 'Bearer 12345',
        ssn: '000-11-2222',
        patientName: 'Alice',
      },
    };

    const sanitized = sanitize(rawPayload);

    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.refreshToken).toBe('[REDACTED]');
    expect(sanitized.nested.authorization).toBe('[REDACTED]');
    expect(sanitized.nested.ssn).toBe('[REDACTED]');
    expect(sanitized.nested.patientName).toBe('Alice');
    expect(sanitized.email).toBe('doctor@medicore.local');
  });

  it('records audit log for sensitive events with sanitized details', async () => {
    await recordAudit({
      userId: 'user-doc-1',
      action: 'PATIENT_RECORD_VIEWED',
      entity: 'Patient',
      entityId: 'pat-1',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      status: 'SUCCESS',
      details: {
        mrn: 'MC-2026-0001',
        password: 'AttemptedPassword',
      },
    });

    expect(prisma.auditRecord.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-doc-1',
        action: 'PATIENT_RECORD_VIEWED',
        entity: 'Patient',
        entityId: 'pat-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        status: 'SUCCESS',
        details: JSON.stringify({
          mrn: 'MC-2026-0001',
          password: '[REDACTED]',
        }),
      },
    });
  });
});
