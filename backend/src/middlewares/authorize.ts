import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../constants/roles.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { recordAudit } from '../services/auditService.js';

/**
 * RBAC authorization middleware.
 * Implements strict "deny-by-default" policy.
 * If user does not have one of allowedRoles, access is denied and audited.
 */
export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!allowedRoles.includes(req.user.role)) {
      recordAudit({
        userId: req.user.userId,
        action: 'ACCESS_DENIED_RBAC',
        entity: req.baseUrl + req.path,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'DENIED',
        details: {
          role: req.user.role,
          requiredRoles: allowedRoles,
        },
      });

      return next(
        new ForbiddenError(
          `Access denied for role '${req.user.role}'. Required role: ${allowedRoles.join(' or ')}`
        )
      );
    }

    next();
  };
}
