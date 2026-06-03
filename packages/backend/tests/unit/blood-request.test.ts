import { describe, it, expect } from 'vitest';
import {
  RequestStatus,
  isValidTransition,
  assertValidTransition,
  VALID_TRANSITIONS,
} from '@mentamind/shared';

describe('Blood Request State Machine', () => {
  describe('valid transitions', () => {
    it('DRAFT → PENDING_VERIFICATION', () => {
      expect(isValidTransition(RequestStatus.DRAFT, RequestStatus.PENDING_VERIFICATION)).toBe(true);
    });

    it('DRAFT → CANCELLED', () => {
      expect(isValidTransition(RequestStatus.DRAFT, RequestStatus.CANCELLED)).toBe(true);
    });

    it('PENDING_VERIFICATION → VERIFIED', () => {
      expect(isValidTransition(RequestStatus.PENDING_VERIFICATION, RequestStatus.VERIFIED)).toBe(true);
    });

    it('PENDING_VERIFICATION → REJECTED', () => {
      expect(isValidTransition(RequestStatus.PENDING_VERIFICATION, RequestStatus.REJECTED)).toBe(true);
    });

    it('VERIFIED → MATCHING', () => {
      expect(isValidTransition(RequestStatus.VERIFIED, RequestStatus.MATCHING)).toBe(true);
    });

    it('MATCHING → MATCHED', () => {
      expect(isValidTransition(RequestStatus.MATCHING, RequestStatus.MATCHED)).toBe(true);
    });

    it('MATCHED → IN_PROGRESS', () => {
      expect(isValidTransition(RequestStatus.MATCHED, RequestStatus.IN_PROGRESS)).toBe(true);
    });

    it('IN_PROGRESS → FULFILLED', () => {
      expect(isValidTransition(RequestStatus.IN_PROGRESS, RequestStatus.FULFILLED)).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('DRAFT → VERIFIED (skip step)', () => {
      expect(isValidTransition(RequestStatus.DRAFT, RequestStatus.VERIFIED)).toBe(false);
    });

    it('DRAFT → MATCHED (skip steps)', () => {
      expect(isValidTransition(RequestStatus.DRAFT, RequestStatus.MATCHED)).toBe(false);
    });

    it('FULFILLED → anything (terminal)', () => {
      for (const status of Object.values(RequestStatus)) {
        expect(isValidTransition(RequestStatus.FULFILLED, status as RequestStatus)).toBe(false);
      }
    });

    it('CANCELLED → anything (terminal)', () => {
      for (const status of Object.values(RequestStatus)) {
        expect(isValidTransition(RequestStatus.CANCELLED, status as RequestStatus)).toBe(false);
      }
    });

    it('REJECTED → anything (terminal)', () => {
      for (const status of Object.values(RequestStatus)) {
        expect(isValidTransition(RequestStatus.REJECTED, status as RequestStatus)).toBe(false);
      }
    });

    it('MATCHING → VERIFIED (backward)', () => {
      expect(isValidTransition(RequestStatus.MATCHING, RequestStatus.VERIFIED)).toBe(false);
    });
  });

  describe('assertValidTransition', () => {
    it('does not throw for valid transitions', () => {
      expect(() =>
        assertValidTransition(RequestStatus.DRAFT, RequestStatus.PENDING_VERIFICATION),
      ).not.toThrow();
    });

    it('throws descriptive error for invalid transitions', () => {
      expect(() =>
        assertValidTransition(RequestStatus.DRAFT, RequestStatus.FULFILLED),
      ).toThrow(/Invalid request status transition/);
    });

    it('mentions allowed transitions in error message', () => {
      try {
        assertValidTransition(RequestStatus.DRAFT, RequestStatus.FULFILLED);
      } catch (e) {
        expect((e as Error).message).toContain('PENDING_VERIFICATION');
        expect((e as Error).message).toContain('CANCELLED');
      }
    });

    it('mentions terminal state for FULFILLED', () => {
      try {
        assertValidTransition(RequestStatus.FULFILLED, RequestStatus.CANCELLED);
      } catch (e) {
        expect((e as Error).message).toContain('terminal state');
      }
    });
  });

  describe('cancellation', () => {
    it('all non-terminal states can be cancelled', () => {
      const nonTerminal = [
        RequestStatus.DRAFT,
        RequestStatus.PENDING_VERIFICATION,
        RequestStatus.VERIFIED,
        RequestStatus.MATCHING,
        RequestStatus.MATCHED,
        RequestStatus.IN_PROGRESS,
      ];

      for (const status of nonTerminal) {
        expect(isValidTransition(status, RequestStatus.CANCELLED)).toBe(true);
      }
    });
  });

  describe('complete happy path', () => {
    it('follows DRAFT → PV → VERIFIED → MATCHING → MATCHED → IN_PROGRESS → FULFILLED', () => {
      const path = [
        RequestStatus.DRAFT,
        RequestStatus.PENDING_VERIFICATION,
        RequestStatus.VERIFIED,
        RequestStatus.MATCHING,
        RequestStatus.MATCHED,
        RequestStatus.IN_PROGRESS,
        RequestStatus.FULFILLED,
      ];

      for (let i = 0; i < path.length - 1; i++) {
        expect(isValidTransition(path[i], path[i + 1])).toBe(true);
      }
    });
  });
});
