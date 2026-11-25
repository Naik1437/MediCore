import { prisma } from '../prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { recordAudit } from './auditService.js';

export interface RecordConsentDTO {
  patientId: string;
  providerId?: string;
  consentType?: 'DATA_SHARING' | 'TREATMENT' | 'RESEARCH' | 'BILLING';
  status?: 'GRANTED' | 'REVOKED';
  expiresAt?: string;
  notes?: string;
}

export class ConsentService {
  static async recordConsent(dto: RecordConsentDTO, actorUserId?: string) {
    const consent = await prisma.consent.create({
      data: {
        patientId: dto.patientId,
        providerId: dto.providerId || null,
        consentType: dto.consentType || 'DATA_SHARING',
        status: dto.status || 'GRANTED',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        notes: dto.notes,
      },
    });

    await recordAudit({
      userId: actorUserId,
      action: 'CONSENT_RECORDED',
      entity: 'Consent',
      entityId: consent.id,
      status: 'SUCCESS',
      details: {
        patientId: dto.patientId,
        consentType: dto.consentType,
        status: dto.status,
      },
    });

    return consent;
  }

  static async revokeConsent(consentId: string, actorUserId?: string) {
    const consent = await prisma.consent.findUnique({
      where: { id: consentId },
    });

    if (!consent) {
      throw new NotFoundError(`Consent record ${consentId} not found`);
    }

    const updated = await prisma.consent.update({
      where: { id: consentId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    await recordAudit({
      userId: actorUserId,
      action: 'CONSENT_REVOKED',
      entity: 'Consent',
      entityId: consentId,
      status: 'SUCCESS',
      details: { patientId: consent.patientId },
    });

    return updated;
  }

  static async grantConsent(consentId: string, actorUserId?: string) {
    const consent = await prisma.consent.findUnique({
      where: { id: consentId },
    });

    if (!consent) {
      throw new NotFoundError(`Consent record ${consentId} not found`);
    }

    const updated = await prisma.consent.update({
      where: { id: consentId },
      data: {
        status: 'GRANTED',
        grantedAt: new Date(),
        revokedAt: null,
      },
    });

    await recordAudit({
      userId: actorUserId,
      action: 'CONSENT_GRANTED',
      entity: 'Consent',
      entityId: consentId,
      status: 'SUCCESS',
      details: { patientId: consent.patientId, consentType: consent.consentType },
    });

    return updated;
  }

  static async getPatientConsents(patientId: string) {
    return prisma.consent.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        provider: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  }
}
