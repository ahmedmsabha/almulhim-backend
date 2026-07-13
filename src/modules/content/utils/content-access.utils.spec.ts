import { computeIsLocked } from './content-access.utils';

describe('content-access.utils', () => {
  describe('computeIsLocked', () => {
    it('returns false for preview lessons regardless of subscription', () => {
      expect(computeIsLocked('preview', false)).toBe(false);
      expect(computeIsLocked('preview', true)).toBe(false);
    });

    it('returns true for subscriber_only lessons without active subscription', () => {
      expect(computeIsLocked('subscriber_only', false)).toBe(true);
    });

    it('returns false for subscriber_only lessons with active subscription', () => {
      expect(computeIsLocked('subscriber_only', true)).toBe(false);
    });
  });
});
