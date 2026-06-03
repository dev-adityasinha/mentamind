import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuditContext {
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Creates an audit log entry directly in the database.
 * This function is designed to never throw — audit failures are logged to console
 * but do not disrupt the main request flow.
 */
export async function createAuditLog(
  userId: string,
  context: AuditContext,
  req?: Request,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: context.action,
        entityType: context.entityType,
        entityId: context.entityId ?? 'N/A',
        oldValue: context.oldValue
          ? JSON.parse(JSON.stringify(context.oldValue))
          : undefined,
        newValue: context.newValue
          ? JSON.parse(JSON.stringify(context.newValue))
          : undefined,
        ipAddress: req?.ip ?? req?.socket?.remoteAddress ?? null,
        userAgent: req?.headers['user-agent'] ?? null,
      },
    });
  } catch (error) {
    // Audit logging should never crash the app
    console.error('[AUDIT] Failed to create audit log:', error);
  }
}

/**
 * Middleware that attaches an audit helper function to the request object.
 * Route handlers can then call `(req as any).audit(context)` to log actions.
 */
export function auditMiddleware(action: string, entityType: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).audit = (
      context: Partial<AuditContext>,
    ) =>
      createAuditLog(
        req.user?.userId ?? 'SYSTEM',
        {
          action,
          entityType,
          ...context,
        },
        req,
      );
    next();
  };
}
