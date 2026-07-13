import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../generated/prisma/client';
import { ROLES_KEY } from '../constants/auth-metadata';

export const Roles = (...roles: UserRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
