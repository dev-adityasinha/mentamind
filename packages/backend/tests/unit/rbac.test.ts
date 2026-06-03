import { describe, it, expect, vi } from 'vitest';
import { Role } from '@mentamind/shared';
import { requireRole } from '../../src/middleware/rbac';
import { AppError } from '../../src/middleware/error-handler';

function createMockReqResNext(userRole?: Role) {
  const req = {
    user: userRole ? { userId: 'test-id', email: 'test@test.com', role: userRole } : undefined,
  } as any;
  const res = {} as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('RBAC Middleware', () => {
  describe('requireRole', () => {
    it('calls next() when user has the required role', () => {
      const middleware = requireRole(Role.ADMIN);
      const { req, res, next } = createMockReqResNext(Role.ADMIN);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('calls next() when user has one of multiple allowed roles', () => {
      const middleware = requireRole(Role.ADMIN, Role.VOLUNTEER);
      const { req, res, next } = createMockReqResNext(Role.VOLUNTEER);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('throws 403 AppError when user has wrong role', () => {
      const middleware = requireRole(Role.ADMIN);
      const { req, res, next } = createMockReqResNext(Role.PATIENT);

      expect(() => middleware(req, res, next)).toThrow(AppError);

      try {
        middleware(req, res, next);
      } catch (e) {
        expect(e).toBeInstanceOf(AppError);
        expect((e as AppError).statusCode).toBe(403);
        expect((e as AppError).code).toBe('INSUFFICIENT_ROLE');
      }
    });

    it('throws 401 AppError when no user on request', () => {
      const middleware = requireRole(Role.ADMIN);
      const { req, res, next } = createMockReqResNext(undefined);

      expect(() => middleware(req, res, next)).toThrow(AppError);

      try {
        middleware(req, res, next);
      } catch (e) {
        expect(e).toBeInstanceOf(AppError);
        expect((e as AppError).statusCode).toBe(401);
        expect((e as AppError).code).toBe('AUTH_REQUIRED');
      }
    });

    it('allows PATIENT to access patient-only routes', () => {
      const middleware = requireRole(Role.PATIENT);
      const { req, res, next } = createMockReqResNext(Role.PATIENT);
      middleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('allows DONOR to access donor-only routes', () => {
      const middleware = requireRole(Role.DONOR);
      const { req, res, next } = createMockReqResNext(Role.DONOR);
      middleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('allows HOSPITAL to access hospital-only routes', () => {
      const middleware = requireRole(Role.HOSPITAL);
      const { req, res, next } = createMockReqResNext(Role.HOSPITAL);
      middleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('denies DONOR access to admin-only routes', () => {
      const middleware = requireRole(Role.ADMIN);
      const { req, res, next } = createMockReqResNext(Role.DONOR);
      expect(() => middleware(req, res, next)).toThrow(AppError);
    });

    it('allows any role when all roles are specified', () => {
      const middleware = requireRole(Role.PATIENT, Role.DONOR, Role.ADMIN, Role.HOSPITAL, Role.VOLUNTEER);
      for (const role of Object.values(Role)) {
        const { req, res, next } = createMockReqResNext(role as Role);
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });
  });
});
