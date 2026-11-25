import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/errors.js';
import { recordAudit } from '../services/auditService.js';
import { UserRole } from '../constants/roles.js';
import { config } from '../config/env.js';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Allow internal service-to-service calls (e.g. analytics engine) with verified shared key
  const internalKey = req.headers['x-internal-key'];
  const expectedInternalKey = config.analyticsSharedSecret;
  if (internalKey && internalKey === expectedInternalKey) {
    req.user = {
      userId: 'system-internal-analytics',
      email: 'system-analytics@medicore.local',
      role: UserRole.DOCTOR, // Provides clinical reading authorization for analytics & FHIR
    };
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    recordAudit({
      userId: null,
      action: 'AUTHENTICATION_REQUIRED',
      entity: req.baseUrl + req.path,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'DENIED',
    });
    return next(new UnauthorizedError('Bearer authentication token is required'));
  }

  const token = authHeader.substring(7).trim();

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error: any) {
    recordAudit({
      userId: null,
      action: 'INVALID_TOKEN',
      entity: req.baseUrl + req.path,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'DENIED',
      details: { reason: error.message },
    });
    return next(new UnauthorizedError('Invalid or expired authentication token'));
  }
}
