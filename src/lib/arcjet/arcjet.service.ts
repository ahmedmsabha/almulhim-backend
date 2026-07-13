import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import arcjet, { type ArcjetNodeRequest } from '@arcjet/node';
import type { ArcjetDecision } from 'arcjet';
import type { AppEnv } from '../../config/env.schema';
import {
  ARCJET_BASE_RULES,
  ARCJET_PROFILE_RULES,
  ARCJET_PROFILES,
  type ArcjetProfile,
} from './arcjet.profiles';

type ArcjetProfileClient = {
  protect(
    request: ArcjetNodeRequest,
    props?: { userId: string },
  ): Promise<ArcjetDecision>;
};
type ArcjetProtectProps = {
  userId?: string;
};

@Injectable()
export class ArcjetService {
  private readonly logger = new Logger(ArcjetService.name);
  private readonly profileClients: Map<
    ArcjetProfile,
    ArcjetProfileClient
  > | null;

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    const enabled = this.configService.get('ARCJET_ENABLED', { infer: true });

    if (!enabled) {
      this.profileClients = null;
      this.logger.log('Arcjet disabled');
      return;
    }

    const key = this.configService.get('ARCJET_KEY', { infer: true }) ?? '';
    const baseClient = arcjet({
      key,
      rules: [...ARCJET_BASE_RULES],
    });

    this.profileClients = new Map(
      ARCJET_PROFILES.map((profile) => {
        const { rateLimit, botDetection } = ARCJET_PROFILE_RULES[profile];
        let client = baseClient.withRule(rateLimit);

        if (botDetection) {
          client = client.withRule(botDetection);
        }

        return [profile, client as ArcjetProfileClient] as const;
      }),
    );

    this.logger.log('Arcjet profile clients initialized');
  }

  isEnabled(): boolean {
    return this.profileClients !== null;
  }

  async protectProfile(
    profile: ArcjetProfile,
    request: ArcjetNodeRequest,
    props?: ArcjetProtectProps,
  ): Promise<ArcjetDecision | null> {
    const client = this.profileClients?.get(profile);

    if (!client) {
      return null;
    }

    try {
      if (props?.userId) {
        return await client.protect(request, { userId: props.userId });
      }

      return await client.protect(request);
    } catch (error) {
      this.logger.error(
        `Arcjet protection check failed for "${profile}"`,
        error,
      );
      return null;
    }
  }
}
