import { describe, it, expect } from 'vitest';
import { canDonate, getCompatibleDonorGroups, getCompatibleRecipientGroups, BloodGroup } from '@mentamind/shared';

/**
 * SAFETY-CRITICAL: Exhaustive blood compatibility matrix tests.
 * Tests all 64 donor×recipient combinations for correctness.
 */
describe('Blood Compatibility Matrix', () => {
  // ─── canDonate: All 64 combinations ─────────────────────────────────────

  describe('canDonate', () => {
    describe('O- recipient (can receive from O- only)', () => {
      it('O- → O-: YES', () => expect(canDonate(BloodGroup.O_NEG, BloodGroup.O_NEG)).toBe(true));
      it('O+ → O-: NO',  () => expect(canDonate(BloodGroup.O_POS, BloodGroup.O_NEG)).toBe(false));
      it('A- → O-: NO',  () => expect(canDonate(BloodGroup.A_NEG, BloodGroup.O_NEG)).toBe(false));
      it('A+ → O-: NO',  () => expect(canDonate(BloodGroup.A_POS, BloodGroup.O_NEG)).toBe(false));
      it('B- → O-: NO',  () => expect(canDonate(BloodGroup.B_NEG, BloodGroup.O_NEG)).toBe(false));
      it('B+ → O-: NO',  () => expect(canDonate(BloodGroup.B_POS, BloodGroup.O_NEG)).toBe(false));
      it('AB- → O-: NO', () => expect(canDonate(BloodGroup.AB_NEG, BloodGroup.O_NEG)).toBe(false));
      it('AB+ → O-: NO', () => expect(canDonate(BloodGroup.AB_POS, BloodGroup.O_NEG)).toBe(false));
    });

    describe('O+ recipient (can receive from O-, O+)', () => {
      it('O- → O+: YES', () => expect(canDonate(BloodGroup.O_NEG, BloodGroup.O_POS)).toBe(true));
      it('O+ → O+: YES', () => expect(canDonate(BloodGroup.O_POS, BloodGroup.O_POS)).toBe(true));
      it('A- → O+: NO',  () => expect(canDonate(BloodGroup.A_NEG, BloodGroup.O_POS)).toBe(false));
      it('A+ → O+: NO',  () => expect(canDonate(BloodGroup.A_POS, BloodGroup.O_POS)).toBe(false));
      it('B- → O+: NO',  () => expect(canDonate(BloodGroup.B_NEG, BloodGroup.O_POS)).toBe(false));
      it('B+ → O+: NO',  () => expect(canDonate(BloodGroup.B_POS, BloodGroup.O_POS)).toBe(false));
      it('AB- → O+: NO', () => expect(canDonate(BloodGroup.AB_NEG, BloodGroup.O_POS)).toBe(false));
      it('AB+ → O+: NO', () => expect(canDonate(BloodGroup.AB_POS, BloodGroup.O_POS)).toBe(false));
    });

    describe('A- recipient (can receive from O-, A-)', () => {
      it('O- → A-: YES', () => expect(canDonate(BloodGroup.O_NEG, BloodGroup.A_NEG)).toBe(true));
      it('O+ → A-: NO',  () => expect(canDonate(BloodGroup.O_POS, BloodGroup.A_NEG)).toBe(false));
      it('A- → A-: YES', () => expect(canDonate(BloodGroup.A_NEG, BloodGroup.A_NEG)).toBe(true));
      it('A+ → A-: NO',  () => expect(canDonate(BloodGroup.A_POS, BloodGroup.A_NEG)).toBe(false));
      it('B- → A-: NO',  () => expect(canDonate(BloodGroup.B_NEG, BloodGroup.A_NEG)).toBe(false));
      it('B+ → A-: NO',  () => expect(canDonate(BloodGroup.B_POS, BloodGroup.A_NEG)).toBe(false));
      it('AB- → A-: NO', () => expect(canDonate(BloodGroup.AB_NEG, BloodGroup.A_NEG)).toBe(false));
      it('AB+ → A-: NO', () => expect(canDonate(BloodGroup.AB_POS, BloodGroup.A_NEG)).toBe(false));
    });

    describe('A+ recipient (can receive from O-, O+, A-, A+)', () => {
      it('O- → A+: YES', () => expect(canDonate(BloodGroup.O_NEG, BloodGroup.A_POS)).toBe(true));
      it('O+ → A+: YES', () => expect(canDonate(BloodGroup.O_POS, BloodGroup.A_POS)).toBe(true));
      it('A- → A+: YES', () => expect(canDonate(BloodGroup.A_NEG, BloodGroup.A_POS)).toBe(true));
      it('A+ → A+: YES', () => expect(canDonate(BloodGroup.A_POS, BloodGroup.A_POS)).toBe(true));
      it('B- → A+: NO',  () => expect(canDonate(BloodGroup.B_NEG, BloodGroup.A_POS)).toBe(false));
      it('B+ → A+: NO',  () => expect(canDonate(BloodGroup.B_POS, BloodGroup.A_POS)).toBe(false));
      it('AB- → A+: NO', () => expect(canDonate(BloodGroup.AB_NEG, BloodGroup.A_POS)).toBe(false));
      it('AB+ → A+: NO', () => expect(canDonate(BloodGroup.AB_POS, BloodGroup.A_POS)).toBe(false));
    });

    describe('B- recipient (can receive from O-, B-)', () => {
      it('O- → B-: YES', () => expect(canDonate(BloodGroup.O_NEG, BloodGroup.B_NEG)).toBe(true));
      it('O+ → B-: NO',  () => expect(canDonate(BloodGroup.O_POS, BloodGroup.B_NEG)).toBe(false));
      it('A- → B-: NO',  () => expect(canDonate(BloodGroup.A_NEG, BloodGroup.B_NEG)).toBe(false));
      it('A+ → B-: NO',  () => expect(canDonate(BloodGroup.A_POS, BloodGroup.B_NEG)).toBe(false));
      it('B- → B-: YES', () => expect(canDonate(BloodGroup.B_NEG, BloodGroup.B_NEG)).toBe(true));
      it('B+ → B-: NO',  () => expect(canDonate(BloodGroup.B_POS, BloodGroup.B_NEG)).toBe(false));
      it('AB- → B-: NO', () => expect(canDonate(BloodGroup.AB_NEG, BloodGroup.B_NEG)).toBe(false));
      it('AB+ → B-: NO', () => expect(canDonate(BloodGroup.AB_POS, BloodGroup.B_NEG)).toBe(false));
    });

    describe('B+ recipient (can receive from O-, O+, B-, B+)', () => {
      it('O- → B+: YES', () => expect(canDonate(BloodGroup.O_NEG, BloodGroup.B_POS)).toBe(true));
      it('O+ → B+: YES', () => expect(canDonate(BloodGroup.O_POS, BloodGroup.B_POS)).toBe(true));
      it('A- → B+: NO',  () => expect(canDonate(BloodGroup.A_NEG, BloodGroup.B_POS)).toBe(false));
      it('A+ → B+: NO',  () => expect(canDonate(BloodGroup.A_POS, BloodGroup.B_POS)).toBe(false));
      it('B- → B+: YES', () => expect(canDonate(BloodGroup.B_NEG, BloodGroup.B_POS)).toBe(true));
      it('B+ → B+: YES', () => expect(canDonate(BloodGroup.B_POS, BloodGroup.B_POS)).toBe(true));
      it('AB- → B+: NO', () => expect(canDonate(BloodGroup.AB_NEG, BloodGroup.B_POS)).toBe(false));
      it('AB+ → B+: NO', () => expect(canDonate(BloodGroup.AB_POS, BloodGroup.B_POS)).toBe(false));
    });

    describe('AB- recipient (can receive from O-, A-, B-, AB-)', () => {
      it('O- → AB-: YES',  () => expect(canDonate(BloodGroup.O_NEG, BloodGroup.AB_NEG)).toBe(true));
      it('O+ → AB-: NO',   () => expect(canDonate(BloodGroup.O_POS, BloodGroup.AB_NEG)).toBe(false));
      it('A- → AB-: YES',  () => expect(canDonate(BloodGroup.A_NEG, BloodGroup.AB_NEG)).toBe(true));
      it('A+ → AB-: NO',   () => expect(canDonate(BloodGroup.A_POS, BloodGroup.AB_NEG)).toBe(false));
      it('B- → AB-: YES',  () => expect(canDonate(BloodGroup.B_NEG, BloodGroup.AB_NEG)).toBe(true));
      it('B+ → AB-: NO',   () => expect(canDonate(BloodGroup.B_POS, BloodGroup.AB_NEG)).toBe(false));
      it('AB- → AB-: YES', () => expect(canDonate(BloodGroup.AB_NEG, BloodGroup.AB_NEG)).toBe(true));
      it('AB+ → AB-: NO',  () => expect(canDonate(BloodGroup.AB_POS, BloodGroup.AB_NEG)).toBe(false));
    });

    describe('AB+ recipient (universal recipient — can receive from ALL)', () => {
      it('O- → AB+: YES',  () => expect(canDonate(BloodGroup.O_NEG, BloodGroup.AB_POS)).toBe(true));
      it('O+ → AB+: YES',  () => expect(canDonate(BloodGroup.O_POS, BloodGroup.AB_POS)).toBe(true));
      it('A- → AB+: YES',  () => expect(canDonate(BloodGroup.A_NEG, BloodGroup.AB_POS)).toBe(true));
      it('A+ → AB+: YES',  () => expect(canDonate(BloodGroup.A_POS, BloodGroup.AB_POS)).toBe(true));
      it('B- → AB+: YES',  () => expect(canDonate(BloodGroup.B_NEG, BloodGroup.AB_POS)).toBe(true));
      it('B+ → AB+: YES',  () => expect(canDonate(BloodGroup.B_POS, BloodGroup.AB_POS)).toBe(true));
      it('AB- → AB+: YES', () => expect(canDonate(BloodGroup.AB_NEG, BloodGroup.AB_POS)).toBe(true));
      it('AB+ → AB+: YES', () => expect(canDonate(BloodGroup.AB_POS, BloodGroup.AB_POS)).toBe(true));
    });
  });

  // ─── getCompatibleDonorGroups ───────────────────────────────────────────

  describe('getCompatibleDonorGroups', () => {
    it('O- can only receive from O-', () => {
      expect(getCompatibleDonorGroups(BloodGroup.O_NEG)).toEqual([BloodGroup.O_NEG]);
    });

    it('O+ can receive from O-, O+', () => {
      expect(getCompatibleDonorGroups(BloodGroup.O_POS)).toEqual([BloodGroup.O_NEG, BloodGroup.O_POS]);
    });

    it('A- can receive from O-, A-', () => {
      expect(getCompatibleDonorGroups(BloodGroup.A_NEG)).toEqual([BloodGroup.O_NEG, BloodGroup.A_NEG]);
    });

    it('A+ can receive from O-, O+, A-, A+', () => {
      expect(getCompatibleDonorGroups(BloodGroup.A_POS)).toEqual([
        BloodGroup.O_NEG, BloodGroup.O_POS, BloodGroup.A_NEG, BloodGroup.A_POS,
      ]);
    });

    it('B- can receive from O-, B-', () => {
      expect(getCompatibleDonorGroups(BloodGroup.B_NEG)).toEqual([BloodGroup.O_NEG, BloodGroup.B_NEG]);
    });

    it('B+ can receive from O-, O+, B-, B+', () => {
      expect(getCompatibleDonorGroups(BloodGroup.B_POS)).toEqual([
        BloodGroup.O_NEG, BloodGroup.O_POS, BloodGroup.B_NEG, BloodGroup.B_POS,
      ]);
    });

    it('AB- can receive from O-, A-, B-, AB-', () => {
      expect(getCompatibleDonorGroups(BloodGroup.AB_NEG)).toEqual([
        BloodGroup.O_NEG, BloodGroup.A_NEG, BloodGroup.B_NEG, BloodGroup.AB_NEG,
      ]);
    });

    it('AB+ can receive from ALL', () => {
      expect(getCompatibleDonorGroups(BloodGroup.AB_POS)).toEqual([
        BloodGroup.O_NEG, BloodGroup.O_POS, BloodGroup.A_NEG, BloodGroup.A_POS,
        BloodGroup.B_NEG, BloodGroup.B_POS, BloodGroup.AB_NEG, BloodGroup.AB_POS,
      ]);
    });
  });

  // ─── getCompatibleRecipientGroups ───────────────────────────────────────

  describe('getCompatibleRecipientGroups', () => {
    it('O- can donate to ALL (universal donor)', () => {
      const recipients = getCompatibleRecipientGroups(BloodGroup.O_NEG);
      expect(recipients).toHaveLength(8);
      for (const bg of Object.values(BloodGroup)) {
        expect(recipients).toContain(bg);
      }
    });

    it('O+ can donate to O+, A+, B+, AB+', () => {
      const recipients = getCompatibleRecipientGroups(BloodGroup.O_POS);
      expect(recipients).toEqual(expect.arrayContaining([
        BloodGroup.O_POS, BloodGroup.A_POS, BloodGroup.B_POS, BloodGroup.AB_POS,
      ]));
      expect(recipients).toHaveLength(4);
    });

    it('AB+ can donate to AB+ only', () => {
      expect(getCompatibleRecipientGroups(BloodGroup.AB_POS)).toEqual([BloodGroup.AB_POS]);
    });
  });

  // ─── Universal rules ───────────────────────────────────────────────────

  describe('universal rules', () => {
    it('O- is universal donor (can donate to all 8 types)', () => {
      for (const recipient of Object.values(BloodGroup)) {
        expect(canDonate(BloodGroup.O_NEG, recipient)).toBe(true);
      }
    });

    it('AB+ is universal recipient (can receive from all 8 types)', () => {
      for (const donor of Object.values(BloodGroup)) {
        expect(canDonate(donor, BloodGroup.AB_POS)).toBe(true);
      }
    });

    it('same blood group always works (self-donation)', () => {
      for (const bg of Object.values(BloodGroup)) {
        expect(canDonate(bg, bg)).toBe(true);
      }
    });

    it('AB+ can only donate to AB+', () => {
      for (const recipient of Object.values(BloodGroup)) {
        if (recipient === BloodGroup.AB_POS) {
          expect(canDonate(BloodGroup.AB_POS, recipient)).toBe(true);
        } else {
          expect(canDonate(BloodGroup.AB_POS, recipient)).toBe(false);
        }
      }
    });

    it('O- can only receive from O-', () => {
      for (const donor of Object.values(BloodGroup)) {
        if (donor === BloodGroup.O_NEG) {
          expect(canDonate(donor, BloodGroup.O_NEG)).toBe(true);
        } else {
          expect(canDonate(donor, BloodGroup.O_NEG)).toBe(false);
        }
      }
    });
  });
});
