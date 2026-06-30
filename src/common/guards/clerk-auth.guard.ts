import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkService } from '../../lib/clerk/clerk.service';
import { IS_PUBLIC_KEY } from '../constants/auth-metadata';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import { extractBearerToken } from '../utils/extract-bearer-token';
import { extractClerkEmailFromPayload } from '../utils/extract-clerk-email-from-payload';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly clerkService: ClerkService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await this.clerkService.verifyBearerToken(token);
      const clerkUserId = payload.sub;

      if (!clerkUserId) {
        throw new UnauthorizedException('Invalid token subject');
      }

      request.clerkUserId = clerkUserId;

      const clerkEmail = extractClerkEmailFromPayload(payload);

      if (clerkEmail) {
        request.clerkEmail = clerkEmail;
      }

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
