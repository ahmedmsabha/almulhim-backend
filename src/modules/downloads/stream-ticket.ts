import { createHmac, timingSafeEqual } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

export type VideoStreamTicketClaims = {
  v: 1;
  userId: string;
  lessonVideoId: string;
  deviceHash: string;
  exp: number;
};

/** Compact HMAC ticket so AVPlayer can stream without custom Authorization headers. */
export function createVideoStreamTicket(
  claims: Omit<VideoStreamTicketClaims, 'v'>,
  secret: string,
): string {
  const payload: VideoStreamTicketClaims = { v: 1, ...claims };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyVideoStreamTicket(
  ticket: string,
  secret: string,
): VideoStreamTicketClaims {
  const parts = ticket.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new UnauthorizedException('Invalid stream ticket');
  }

  const [body, sig] = parts;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);

  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    throw new UnauthorizedException('Invalid stream ticket');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new UnauthorizedException('Invalid stream ticket');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as VideoStreamTicketClaims).v !== 1 ||
    typeof (parsed as VideoStreamTicketClaims).userId !== 'string' ||
    typeof (parsed as VideoStreamTicketClaims).lessonVideoId !== 'string' ||
    typeof (parsed as VideoStreamTicketClaims).deviceHash !== 'string' ||
    typeof (parsed as VideoStreamTicketClaims).exp !== 'number'
  ) {
    throw new UnauthorizedException('Invalid stream ticket');
  }

  const claims = parsed as VideoStreamTicketClaims;
  if (claims.exp * 1000 < Date.now()) {
    throw new UnauthorizedException('Stream ticket expired');
  }

  return claims;
}
