export enum MedicineRequestStatus {
  DRAFT = 'DRAFT',
  PENDING_OCR = 'PENDING_OCR',
  OCR_COMPLETE = 'OCR_COMPLETE',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  DISPATCHED = 'DISPATCHED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

/**
 * Defines the valid state transitions for medicine request statuses.
 * Terminal states (DELIVERED, CANCELLED, REJECTED) have no outgoing transitions.
 */
export const VALID_MEDICINE_TRANSITIONS: Record<MedicineRequestStatus, MedicineRequestStatus[]> = {
  [MedicineRequestStatus.DRAFT]: [MedicineRequestStatus.PENDING_OCR, MedicineRequestStatus.CANCELLED],
  [MedicineRequestStatus.PENDING_OCR]: [
    MedicineRequestStatus.OCR_COMPLETE,
    MedicineRequestStatus.CANCELLED,
  ],
  [MedicineRequestStatus.OCR_COMPLETE]: [
    MedicineRequestStatus.PENDING_REVIEW,
    MedicineRequestStatus.CANCELLED,
  ],
  [MedicineRequestStatus.PENDING_REVIEW]: [
    MedicineRequestStatus.APPROVED,
    MedicineRequestStatus.REJECTED,
    MedicineRequestStatus.CANCELLED,
  ],
  [MedicineRequestStatus.APPROVED]: [MedicineRequestStatus.DISPATCHED, MedicineRequestStatus.CANCELLED],
  [MedicineRequestStatus.DISPATCHED]: [MedicineRequestStatus.DELIVERED, MedicineRequestStatus.CANCELLED],
  [MedicineRequestStatus.DELIVERED]: [],
  [MedicineRequestStatus.CANCELLED]: [],
  [MedicineRequestStatus.REJECTED]: [],
};

/**
 * Checks whether a transition from one medicine request status to another is valid.
 */
export function isValidMedicineTransition(
  from: MedicineRequestStatus,
  to: MedicineRequestStatus,
): boolean {
  const allowed = VALID_MEDICINE_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Asserts that a transition from one medicine request status to another is valid.
 * Throws an Error with a descriptive message if the transition is not allowed.
 */
export function assertValidMedicineTransition(
  from: MedicineRequestStatus,
  to: MedicineRequestStatus,
): void {
  if (!isValidMedicineTransition(from, to)) {
    const allowed = VALID_MEDICINE_TRANSITIONS[from];
    const allowedStr = allowed.length > 0 ? allowed.join(', ') : '(none — terminal state)';
    throw new Error(
      `Invalid medicine request status transition from "${from}" to "${to}". ` +
        `Allowed transitions from "${from}": ${allowedStr}.`,
    );
  }
}
