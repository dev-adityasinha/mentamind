import { Request, Response, NextFunction } from 'express';
import { Role } from '@mentamind/shared';
import { AppError } from './error-handler.js';

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      throw new AppError(
        `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        403,
        'INSUFFICIENT_ROLE',
      );
    }

    next();
  };
}
