import { extractClerkEmailFromPayload } from './extract-clerk-email-from-payload';

describe('extractClerkEmailFromPayload', () => {
  it('returns trimmed email when claim is present', () => {
    expect(
      extractClerkEmailFromPayload({
        sub: 'user_123',
        email: '  student@example.com  ',
      } as never),
    ).toBe('student@example.com');
  });

  it('returns null when email claim is missing', () => {
    expect(
      extractClerkEmailFromPayload({
        sub: 'user_123',
      } as never),
    ).toBeNull();
  });

  it('returns null when email claim is empty', () => {
    expect(
      extractClerkEmailFromPayload({
        sub: 'user_123',
        email: '   ',
      } as never),
    ).toBeNull();
  });
});
