import { computeIsLocked } from './content-access.utils';

describe('content-access.utils', () => {
  const unitId = 'unit-1';

  describe('computeIsLocked', () => {
    it('returns false for preview lessons regardless of entitlement', () => {
      expect(computeIsLocked('preview', unitId, new Set())).toBe(false);
      expect(computeIsLocked('preview', unitId, new Set([unitId]))).toBe(false);
    });

    it('returns true for subscriber_only lessons without the unit entitlement', () => {
      expect(computeIsLocked('subscriber_only', unitId, new Set())).toBe(true);
      expect(
        computeIsLocked('subscriber_only', unitId, new Set(['other-unit'])),
      ).toBe(true);
    });

    it('returns false for subscriber_only lessons when the unit is entitled', () => {
      expect(
        computeIsLocked('subscriber_only', unitId, new Set([unitId])),
      ).toBe(false);
    });
  });
});
