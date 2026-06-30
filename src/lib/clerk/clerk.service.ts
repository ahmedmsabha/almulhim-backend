import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createClerkClient,
  verifyToken,
  type ClerkClient,
} from '@clerk/backend';
import type { JwtPayload } from '@clerk/shared/types';
import type { AppEnv } from '../../config/env.schema';

export type VerifyBearerTokenOptions = {
  authorizedParties?: string[];
};

@Injectable()
export class ClerkService {
  private readonly logger = new Logger(ClerkService.name);
  private readonly clerkClient: ClerkClient;

  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
  ) {
    this.clerkClient = createClerkClient({
      secretKey: this.configService.get('CLERK_SECRET_KEY', { infer: true }),
      publishableKey: this.configService.get('CLERK_PUBLISHABLE_KEY', {
        infer: true,
      }),
    });
  }

  getClient(): ClerkClient {
    return this.clerkClient;
  }

  async verifyBearerToken(
    token: string,
    options?: VerifyBearerTokenOptions,
  ): Promise<JwtPayload> {
    try {
      return await verifyToken(token, {
        jwtKey: this.configService.get('CLERK_JWT_KEY', { infer: true }),
        secretKey: this.configService.get('CLERK_SECRET_KEY', { infer: true }),
        authorizedParties: options?.authorizedParties,
      });
    } catch (error) {
      this.logger.warn('Clerk token verification failed');
      throw error;
    }
  }
}
