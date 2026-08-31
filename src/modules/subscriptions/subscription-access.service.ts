import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../lib/database/prisma.service';

@Injectable()
export class SubscriptionAccessService {
  private readonly logger = new Logger(SubscriptionAccessService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async getEntitledUnitIds(userId: string): Promise<Set<string>> {
    try {
      const subs = await this.prismaService.subscription.findMany({
        where: { userId, status: 'active', expiresAt: { gt: new Date() } },
        select: { plan: { select: { units: { select: { unitId: true } } } } },
      });

      return new Set(subs.flatMap((s) => s.plan.units.map((u) => u.unitId)));
    } catch (error) {
      this.logger.error(
        `Failed to resolve entitled units for user ${userId}`,
        error,
      );
      throw error;
    }
  }
}
