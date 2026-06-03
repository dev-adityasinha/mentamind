import { BloodGroup } from '../enums/blood-group';

/**
 * SAFETY-CRITICAL: ABO/Rh compatibility matrix for RED BLOOD CELL transfusion.
 *
 * For each RECIPIENT blood group, lists all DONOR blood groups that are compatible
 * (i.e., blood groups from which the recipient can safely receive red blood cells).
 *
 * Medical reference:
 * - O- is the universal donor (can donate to all)
 * - AB+ is the universal recipient (can receive from all)
 */
export const COMPATIBILITY_MATRIX: Record<BloodGroup, BloodGroup[]> = {
  // O- can receive from: O- only
  [BloodGroup.O_NEG]: [BloodGroup.O_NEG],

  // O+ can receive from: O-, O+
  [BloodGroup.O_POS]: [BloodGroup.O_NEG, BloodGroup.O_POS],

  // A- can receive from: O-, A-
  [BloodGroup.A_NEG]: [BloodGroup.O_NEG, BloodGroup.A_NEG],

  // A+ can receive from: O-, O+, A-, A+
  [BloodGroup.A_POS]: [BloodGroup.O_NEG, BloodGroup.O_POS, BloodGroup.A_NEG, BloodGroup.A_POS],

  // B- can receive from: O-, B-
  [BloodGroup.B_NEG]: [BloodGroup.O_NEG, BloodGroup.B_NEG],

  // B+ can receive from: O-, O+, B-, B+
  [BloodGroup.B_POS]: [BloodGroup.O_NEG, BloodGroup.O_POS, BloodGroup.B_NEG, BloodGroup.B_POS],

  // AB- can receive from: O-, A-, B-, AB-
  [BloodGroup.AB_NEG]: [BloodGroup.O_NEG, BloodGroup.A_NEG, BloodGroup.B_NEG, BloodGroup.AB_NEG],

  // AB+ can receive from: ALL (universal recipient)
  [BloodGroup.AB_POS]: [
    BloodGroup.O_NEG,
    BloodGroup.O_POS,
    BloodGroup.A_NEG,
    BloodGroup.A_POS,
    BloodGroup.B_NEG,
    BloodGroup.B_POS,
    BloodGroup.AB_NEG,
    BloodGroup.AB_POS,
  ],
};

/**
 * Checks whether a donor with the given blood group can donate red blood cells
 * to a recipient with the given blood group.
 *
 * @param donorGroup - The blood group of the donor
 * @param recipientGroup - The blood group of the recipient
 * @returns true if the donation is compatible, false otherwise
 */
export function canDonate(donorGroup: BloodGroup, recipientGroup: BloodGroup): boolean {
  const compatibleDonors = COMPATIBILITY_MATRIX[recipientGroup];
  return compatibleDonors.includes(donorGroup);
}

/**
 * Returns all blood groups that CAN donate red blood cells to the given recipient.
 *
 * @param recipientGroup - The blood group of the recipient
 * @returns An array of compatible donor blood groups
 */
export function getCompatibleDonorGroups(recipientGroup: BloodGroup): BloodGroup[] {
  return [...COMPATIBILITY_MATRIX[recipientGroup]];
}

/**
 * Returns all blood groups that CAN receive red blood cells from the given donor.
 *
 * @param donorGroup - The blood group of the donor
 * @returns An array of compatible recipient blood groups
 */
export function getCompatibleRecipientGroups(donorGroup: BloodGroup): BloodGroup[] {
  const recipients: BloodGroup[] = [];
  const allGroups = Object.values(BloodGroup);

  for (const recipientGroup of allGroups) {
    if (COMPATIBILITY_MATRIX[recipientGroup].includes(donorGroup)) {
      recipients.push(recipientGroup);
    }
  }

  return recipients;
}
