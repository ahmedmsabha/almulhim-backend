import { extractBearerToken } from './extract-bearer-token';

describe('extractBearerToken', () => {
  it('returns token for valid bearer header', () => {
    expect(extractBearerToken('Bearer session_token')).toBe('session_token');
  });

  it('returns undefined when header is missing', () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
  });

  it('returns undefined for non-bearer schemes', () => {
    expect(extractBearerToken('Basic abc123')).toBeUndefined();
  });

  it('returns undefined when bearer token is empty', () => {
    expect(extractBearerToken('Bearer')).toBeUndefined();
  });
});
