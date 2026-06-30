import type { JwtPayload } from '@clerk/shared/types';

export const extractClerkEmailFromPayload = (
  payload: JwtPayload,
): string | null => {
  const email = payload.email;

  if (typeof email !== 'string') {
    return null;
  }

  const trimmed = email.trim();

  return trimmed.length > 0 ? trimmed : null;
};
