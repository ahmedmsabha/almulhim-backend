import { Module } from '@nestjs/common';
import { PostHogModule } from '../../lib/posthog';
import { StorageModule } from '../../lib/storage';
import { AuthModule } from '../auth/auth.module';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [AuthModule, StorageModule, PostHogModule],
  controllers: [PlansController, SubscriptionsController],
  providers: [PlansService, SubscriptionsService],
  exports: [PlansService, SubscriptionsService],
})
export class SubscriptionsModule {}
