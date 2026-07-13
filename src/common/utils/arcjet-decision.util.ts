import {
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ArcjetDecision } from 'arcjet';

export const assertArcjetAllowed = (decision: ArcjetDecision): void => {
  if (!decision.isDenied()) {
    return;
  }

  if (decision.reason.isRateLimit()) {
    throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }

  throw new ForbiddenException('Request blocked');
};
