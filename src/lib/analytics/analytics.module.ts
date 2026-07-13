import { Global, Module } from '@nestjs/common';
import { PostHogModule } from '../posthog';
import { AnalyticsService } from './analytics.service';

@Global()
@Module({
  imports: [PostHogModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
