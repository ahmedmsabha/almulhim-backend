import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';

export const ClerkUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const clerkUserId = request.clerkUserId;

    if (!clerkUserId) {
      throw new UnauthorizedException('Authentication required');
    }

    return clerkUserId;
  },
);
