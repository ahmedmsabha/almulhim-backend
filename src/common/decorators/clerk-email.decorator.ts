import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';

export const ClerkEmail = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const clerkEmail = request.clerkEmail;

    if (!clerkEmail) {
      throw new UnauthorizedException('Email claim missing from session token');
    }

    return clerkEmail;
  },
);
