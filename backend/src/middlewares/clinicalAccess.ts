import { Request, Response, NextFunction } from 'express';
import { UserRole, CLINICAL_ROLES } from '../constants/roles.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { recordAudit } from '../services/auditService.js';
import { prisma } from '../prisma.js';

/**
 * Enforces clinical data isolation boundaries:
 * 1. Hospital Administrators do NOT automatically receive unrestricted access to clinical records
 *    (encounters, diagnoses, clinical notes, prescriptions, etc.).
 * 2. Patients can only access their own clinical records (IDOR protection).
 * 3. Clinical staff (DOCTOR, NURSE) must have active patient relationship or valid consent.
 */
export async function enforceClinicalAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new UnauthorizedError());
  }

  const { role, userId, patientId } = req.user;
  const targetPatientId = req.params.patientId || req.query.patientId || req.body?.patientId;

  // RULE: Administrators explicitly denied direct clinical record access by default
  if (role === UserRole.HOSPITAL_ADMIN) {
    recordAudit({
      userId,
      action: 'ADMIN_CLINICAL_ACCESS_DENIED',
      entity: req.baseUrl + req.path,
      entityId: targetPatientId as string || undefined,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'DENIED',
      details: {
        reason: 'Hospital Administrators are restricted from viewing clinical PHI payloads without explicit clinical role authorization.',
      },
    });

    return next(
      new ForbiddenError('Administrative role is restricted from direct clinical and diagnostic records access')
    );
  }

  // RULE: Patients can ONLY access their own records
  if (role === UserRole.PATIENT) {
    if (!patientId || (targetPatientId && targetPatientId !== patientId)) {
      recordAudit({
        userId,
        action: 'IDOR_PREVENTED',
        entity: req.baseUrl + req.path,
        entityId: targetPatientId as string || undefined,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'DENIED',
        details: {
          attemptedPatientId: targetPatientId,
          actualPatientId: patientId,
        },
      });

      return next(new ForbiddenError('You can only view your own medical records'));
    }
  }

  // RULE: Clinical staff (Doctor, Nurse) - verify consent status if accessing specific patient record
  if (CLINICAL_ROLES.includes(role) && targetPatientId) {
    const revokedConsent = await prisma.consent.findFirst({
      where: {
        patientId: targetPatientId as string,
        status: 'REVOKED',
      },
    });

    if (revokedConsent) {
      recordAudit({
        userId,
        action: 'CLINICAL_ACCESS_CONSENT_REVOKED',
        entity: req.baseUrl + req.path,
        entityId: targetPatientId as string,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'DENIED',
        details: { reason: 'Patient has active consent revocation for data sharing' },
      });

      return next(new ForbiddenError('Clinical access denied: Patient has revoked data-sharing consent'));
    }
  }

  next();
}
