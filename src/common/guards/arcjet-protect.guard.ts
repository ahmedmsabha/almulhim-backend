import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ArcjetService } from '../../lib/arcjet/arcjet.service';
import type { ArcjetProfile } from '../../lib/arcjet/arcjet.profiles';
import { ARCJET_PROTECT_KEY } from '../constants/arcjet-metadata';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import { assertArcjetAllowed } from '../utils/arcjet-decision.util';

@Injectable()
export class ArcjetProtectGuard implements CanActivate {
  private readonly logger = new Logger(ArcjetProtectGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly arcjetService: ArcjetService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const profile = this.reflector.get<ArcjetProfile | undefined>(
      ARCJET_PROTECT_KEY,
      context.getHandler(),
    );

    if (!profile || !this.arcjetService.isEnabled()) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id ?? request.clerkUserId;

    const decision = await this.arcjetService.protectProfile(
      profile,
      request,
      userId ? { userId } : undefined,
    );

    if (!decision) {
      return true;
    }

    if (decision.isErrored()) {
      this.logger.warn(
        `Arcjet errored for profile "${profile}"; failing open`,
      );
      return true;
    }

    assertArcjetAllowed(decision);
    return true;
  }
}
