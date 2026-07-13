import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { assertArcjetAllowed } from './arcjet-decision.util';

describe('assertArcjetAllowed', () => {
  it('does nothing when the decision is allowed', () => {
    expect(() =>
      assertArcjetAllowed({
        isDenied: () => false,
      } as never),
    ).not.toThrow();
  });

  it('throws 429 for rate-limit denials', () => {
    expect(() =>
      assertArcjetAllowed({
        isDenied: () => true,
        reason: {
          isRateLimit: () => true,
        },
      } as never),
    ).toThrow(HttpException);

    try {
      assertArcjetAllowed({
        isDenied: () => true,
        reason: {
          isRateLimit: () => true,
        },
      } as never);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('throws 403 for other denials', () => {
    expect(() =>
      assertArcjetAllowed({
        isDenied: () => true,
        reason: {
          isRateLimit: () => false,
        },
      } as never),
    ).toThrow(ForbiddenException);
  });
});
