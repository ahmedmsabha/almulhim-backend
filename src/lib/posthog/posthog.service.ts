import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';
import type { AppEnv } from '../../config/env.schema';

export type PostHogEventProperties = Record<
  string,
  string | number | boolean | null
>;

@Injectable()
export class PostHogService implements OnModuleDestroy {
  private readonly logger = new Logger(PostHogService.name);
  private readonly client: PostHog | null;

  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
  ) {
    const enabled = this.configService.get('POSTHOG_ENABLED', { infer: true });

    if (!enabled) {
      this.client = null;
      this.logger.log('PostHog disabled');
      return;
    }

    this.client = new PostHog(
      this.configService.get('POSTHOG_API_KEY', { infer: true }) ?? '',
      {
        host: this.configService.get('POSTHOG_HOST', { infer: true }),
      },
    );

    this.logger.log('PostHog client initialized');
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  capture(
    distinctId: string,
    event: string,
    properties?: PostHogEventProperties,
  ): void {
    if (!this.client) {
      return;
    }

    try {
      this.client.capture({
        distinctId,
        event,
        properties,
      });
    } catch (error) {
      this.logger.error(`Failed to capture PostHog event: ${event}`, error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.shutdown();
      this.logger.log('PostHog client shut down');
    } catch (error) {
      this.logger.error('Failed to shut down PostHog client', error);
      throw error;
    }
  }
}
