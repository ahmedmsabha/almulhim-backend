import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AiModule } from '../../lib/ai';
import { StorageModule } from '../../lib/storage';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { ReceiptVerificationRetryScheduler } from './receipt-verification-retry.scheduler';
import { ReceiptVerificationService } from './receipt-verification.service';
import { SubscriptionExpiryScheduler } from './subscription-expiry.scheduler';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [StorageModule, AiModule, ScheduleModule],
  controllers: [
    // Student static routes (`GET me`, `POST receipt-upload-url`) must register
    // before admin `GET :id`, or `/subscriptions/me` is captured as an id and
    // returns 403 from the admin RolesGuard.
    SubscriptionsController,
    AdminSubscriptionsController,
    PlansController,
  ],
  providers: [
    AdminSubscriptionsService,
    PlansService,
    SubscriptionsService,
    ReceiptVerificationService,
    ReceiptVerificationRetryScheduler,
    SubscriptionExpiryScheduler,
  ],
  exports: [
    AdminSubscriptionsService,
    PlansService,
    SubscriptionsService,
    ReceiptVerificationService,
  ],
})
export class SubscriptionsModule {}
