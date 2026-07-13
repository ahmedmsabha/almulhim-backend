import type { Request } from 'express';
import type { DeviceType, User } from '../../generated/prisma/client';

export type DeviceRequestContext = {
  deviceType: DeviceType;
  deviceIdentifier: string;
  deviceHash: string;
};

export type AuthenticatedRequest = Request & {
  clerkUserId?: string;
  clerkEmail?: string;
  user?: User;
  device?: DeviceRequestContext;
};
