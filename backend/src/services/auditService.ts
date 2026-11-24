import { prisma } from '../prisma.js';
import { logger, sanitize } from '../utils/logger.js';

export interface AuditParams {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  status: 'SUCCESS' | 'DENIED' | 'FAILED';
  details?: Record<string, any> | null;
}

export async function recordAudit(params: AuditParams): Promise<void> {
  const sanitizedDetails = params.details ? sanitize(params.details) : undefined;

  // Log asynchronously to database without blocking request execution
  try {
    await prisma.auditRecord.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        status: params.status,
        details: sanitizedDetails ? JSON.stringify(sanitizedDetails) : undefined,
      },
    });
  } catch (error) {
    // Audit failures should be recorded to standard error logger but must not crash the app
    logger.error(`Failed to persist audit log: ${params.action} on ${params.entity}`, error);
  }
}
