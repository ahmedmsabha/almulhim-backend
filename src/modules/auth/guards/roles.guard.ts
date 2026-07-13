import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../../generated/prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../../common/constants/auth-metadata';
import type { AuthenticatedRequest } from '../../../common/types/authenticated-request.type';
import { AuthService } from '../auth.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles === undefined) {
      return true;
    }

    if (requiredRoles.length === 0) {
      throw new ForbiddenException('Route requires at least one role');
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const clerkUserId = request.clerkUserId;

    if (!clerkUserId) {
      throw new UnauthorizedException('Authentication required');
    }

    const user =
      request.user ?? (await this.authService.findUserByClerkId(clerkUserId));

    if (!user) {
      throw new ForbiddenException('User is not registered');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    request.user = user;
    return true;
  }
}
