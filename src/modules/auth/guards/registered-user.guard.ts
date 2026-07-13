import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  REQUIRES_REGISTRATION_KEY,
  STUDENT_ONLY_KEY,
} from '../../../common/constants/auth-metadata';
import type { AuthenticatedRequest } from '../../../common/types/authenticated-request.type';
import { AuthService } from '../auth.service';

@Injectable()
export class RegisteredUserGuard implements CanActivate {
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

    const requiresRegistration = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_REGISTRATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresRegistration) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const clerkUserId = request.clerkUserId;

    if (!clerkUserId) {
      throw new UnauthorizedException('Authentication required');
    }

    if (request.user) {
      this.assertNotDeactivated(request.user);
      return this.assertStudentOnly(context, request.user.role);
    }

    const user = await this.authService.findUserByClerkId(clerkUserId);

    if (!user) {
      throw new NotFoundException('User is not registered');
    }

    this.assertNotDeactivated(user);
    request.user = user;
    return this.assertStudentOnly(context, user.role);
  }

  private assertNotDeactivated(user: { deactivatedAt: Date | null }): void {
    if (user.deactivatedAt !== null) {
      throw new ForbiddenException('Student account is deactivated');
    }
  }

  private assertStudentOnly(context: ExecutionContext, role: string): boolean {
    const studentOnly = this.reflector.getAllAndOverride<boolean>(
      STUDENT_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (studentOnly && role !== 'student') {
      throw new ForbiddenException('Student account required');
    }

    return true;
  }
}
