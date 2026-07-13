import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminSubscriptionsService } from './admin-subscriptions.service';

@Injectable()
export class SubscriptionExpiryScheduler {
  private readonly logger = new Logger(SubscriptionExpiryScheduler.name);

  constructor(
    private readonly adminSubscriptionsService: AdminSubscriptionsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireStaleSubscriptions(): Promise<void> {
    this.logger.log('Running hourly subscription expiry check');
    await this.adminSubscriptionsService.expireStaleSubscriptions();
  }
}
