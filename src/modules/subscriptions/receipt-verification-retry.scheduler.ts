import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../lib/database/prisma.service';
import { ReceiptVerificationService } from './receipt-verification.service';

const STALE_VERIFICATION_MINUTES = 5;
const STALE_VERIFICATION_BATCH_SIZE = 20;

@Injectable()
export class ReceiptVerificationRetryScheduler {
  private readonly logger = new Logger(ReceiptVerificationRetryScheduler.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly receiptVerificationService: ReceiptVerificationService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryStaleVerifications(): Promise<void> {
    const staleBefore = new Date(
      Date.now() - STALE_VERIFICATION_MINUTES * 60 * 1000,
    );

    try {
      const staleSubscriptions = await this.prismaService.subscription.findMany({
        where: {
          status: 'pending_review',
          verifiedAt: null,
          createdAt: { lte: staleBefore },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: STALE_VERIFICATION_BATCH_SIZE,
      });

      if (staleSubscriptions.length === 0) {
        return;
      }

      this.logger.log(
        `Retrying receipt verification for ${staleSubscriptions.length} stale subscription(s)`,
      );

      for (const subscription of staleSubscriptions) {
        if (
          this.receiptVerificationService.isVerificationInFlight(
            subscription.id,
          )
        ) {
          continue;
        }

        this.receiptVerificationService.scheduleVerification(subscription.id);
      }
    } catch (error) {
      this.logger.error('Failed to retry stale receipt verifications', error);
    }
  }
}
