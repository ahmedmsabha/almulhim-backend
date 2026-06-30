import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import arcjet, { shield, type ArcjetNodeRequest } from '@arcjet/node';
import type { ArcjetDecision } from 'arcjet';
import type { AppEnv } from '../../config/env.schema';

type ArcjetInstance = ReturnType<typeof arcjet>;

@Injectable()
export class ArcjetService {
  private readonly logger = new Logger(ArcjetService.name);
  private readonly client: ArcjetInstance | null;

  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
  ) {
    const enabled = this.configService.get('ARCJET_ENABLED', { infer: true });

    if (!enabled) {
      this.client = null;
      this.logger.log('Arcjet disabled');
      return;
    }

    this.client = arcjet({
      key: this.configService.get('ARCJET_KEY', { infer: true }) ?? '',
      rules: [shield({ mode: 'DRY_RUN' })],
    });

    this.logger.log('Arcjet client initialized');
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  getClient(): ArcjetInstance | null {
    return this.client;
  }

  async protect(request: ArcjetNodeRequest): Promise<ArcjetDecision | null> {
    if (!this.client) {
      return null;
    }

    try {
      return await this.client.protect(request);
    } catch (error) {
      this.logger.error('Arcjet protection check failed', error);
      throw error;
    }
  }
}
