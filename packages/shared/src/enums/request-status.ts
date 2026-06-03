export enum RequestStatus {
  DRAFT = 'DRAFT',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  MATCHING = 'MATCHING',
  MATCHED = 'MATCHED',
  IN_PROGRESS = 'IN_PROGRESS',
  FULFILLED = 'FULFILLED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

/**
 * Defines the valid state transitions for blood request statuses.
 * Terminal states (FULFILLED, CANCELLED, REJECTED) have no outgoing transitions.
 */
export const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.DRAFT]: [RequestStatus.PENDING_VERIFICATION, RequestStatus.CANCELLED],
  [RequestStatus.PENDING_VERIFICATION]: [
    RequestStatus.VERIFIED,
    RequestStatus.REJECTED,
    RequestStatus.CANCELLED,
  ],
  [RequestStatus.VERIFIED]: [RequestStatus.MATCHING, RequestStatus.CANCELLED],
  [RequestStatus.MATCHING]: [RequestStatus.MATCHED, RequestStatus.CANCELLED],
  [RequestStatus.MATCHED]: [RequestStatus.IN_PROGRESS, RequestStatus.CANCELLED],
  [RequestStatus.IN_PROGRESS]: [RequestStatus.FULFILLED, RequestStatus.CANCELLED],
  [RequestStatus.FULFILLED]: [],
  [RequestStatus.CANCELLED]: [],
  [RequestStatus.REJECTED]: [],
};

/**
 * Checks whether a transition from one request status to another is valid.
 */
export function isValidTransition(from: RequestStatus, to: RequestStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Asserts that a transition from one request status to another is valid.
 * Throws an Error with a descriptive message if the transition is not allowed.
 */
export function assertValidTransition(from: RequestStatus, to: RequestStatus): void {
  if (!isValidTransition(from, to)) {
    const allowed = VALID_TRANSITIONS[from];
    const allowedStr = allowed.length > 0 ? allowed.join(', ') : '(none — terminal state)';
    throw new Error(
      `Invalid request status transition from "${from}" to "${to}". ` +
        `Allowed transitions from "${from}": ${allowedStr}.`,
    );
  }
}
