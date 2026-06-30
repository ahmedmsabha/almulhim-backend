import type { Request } from 'express';
import type { User } from '../../generated/prisma/client';

export type AuthenticatedRequest = Request & {
  clerkUserId?: string;
  clerkEmail?: string;
  user?: User;
};
