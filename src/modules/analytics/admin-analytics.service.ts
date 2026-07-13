import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type {
  StudentRegion,
  SubscriptionStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../lib/database/prisma.service';
import type {
  DashboardRecentActivity,
  DashboardRegion,
  DashboardStats,
  DashboardSubscriptionGrowthPoint,
} from './types/admin-dashboard.response';

const RECENT_ACTIVITY_LIMIT = 10;
const SUBSCRIPTION_GROWTH_DAYS = 30;

const SUBSCRIPTION_STATUS_ACTIONS: Partial<Record<SubscriptionStatus, string>> =
  {
    pending_review: 'Submitted subscription',
    pending_approval: 'Subscription pending approval',
    active: 'Subscription approved',
    rejected: 'Subscription rejected',
    suspended: 'Subscription suspended',
    expired: 'Subscription expired',
  };

@Injectable()
export class AdminAnalyticsService {
  private readonly logger = new Logger(AdminAnalyticsService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async getDashboard(): Promise<DashboardStats> {
    try {
      const growthWindowStart = this.getGrowthWindowStart();

      const [
        totalStudents,
        activeSubscriptions,
        pendingApprovals,
        openSupportTickets,
        regionGroups,
        recentSubscriptions,
        recentSupportRequests,
        growthSubscriptions,
      ] = await Promise.all([
        this.prismaService.user.count({ where: { role: 'student' } }),
        this.prismaService.subscription.count({
          where: { status: 'active' },
        }),
        this.prismaService.subscription.count({
          where: { status: 'pending_approval' },
        }),
        this.prismaService.supportRequest.count({
          where: { status: 'open' },
        }),
        this.prismaService.user.groupBy({
          by: ['region'],
          where: { role: 'student' },
          _count: { _all: true },
        }),
        this.prismaService.subscription.findMany({
          include: { user: { select: { fullName: true } } },
          orderBy: { updatedAt: 'desc' },
          take: RECENT_ACTIVITY_LIMIT,
        }),
        this.prismaService.supportRequest.findMany({
          include: { user: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: RECENT_ACTIVITY_LIMIT,
        }),
        this.prismaService.subscription.findMany({
          where: { createdAt: { gte: growthWindowStart } },
          select: { createdAt: true },
        }),
      ]);

      return {
        totalStudents,
        activeSubscriptions,
        pendingApprovals,
        openSupportTickets,
        subscriptionGrowth: this.buildSubscriptionGrowth(
          growthSubscriptions,
          growthWindowStart,
        ),
        regionDistribution: this.buildRegionDistribution(regionGroups),
        recentActivity: this.buildRecentActivity(
          recentSubscriptions,
          recentSupportRequests,
        ),
      };
    } catch (error) {
      this.logger.error('Failed to load admin analytics dashboard', error);
      throw new InternalServerErrorException(
        'Failed to load analytics dashboard',
      );
    }
  }

  private getGrowthWindowStart(): Date {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (SUBSCRIPTION_GROWTH_DAYS - 1));
    return start;
  }

  private buildSubscriptionGrowth(
    subscriptions: Array<{ createdAt: Date }>,
    windowStart: Date,
  ): DashboardSubscriptionGrowthPoint[] {
    const countsByDate = new Map<string, number>();

    for (const subscription of subscriptions) {
      const date = this.toUtcDateString(subscription.createdAt);
      countsByDate.set(date, (countsByDate.get(date) ?? 0) + 1);
    }

    const points: DashboardSubscriptionGrowthPoint[] = [];

    for (let offset = 0; offset < SUBSCRIPTION_GROWTH_DAYS; offset += 1) {
      const day = new Date(windowStart);
      day.setUTCDate(windowStart.getUTCDate() + offset);
      const date = this.toUtcDateString(day);
      points.push({
        date,
        count: countsByDate.get(date) ?? 0,
      });
    }

    return points;
  }

  private buildRegionDistribution(
    regionGroups: Array<{ region: StudentRegion; _count: { _all: number } }>,
  ): Array<{ region: DashboardRegion; count: number }> {
    const counts: Record<DashboardRegion, number> = {
      gaza: 0,
      west_bank: 0,
    };

    for (const group of regionGroups) {
      counts[group.region] = group._count._all;
    }

    return [
      { region: 'gaza', count: counts.gaza },
      { region: 'west_bank', count: counts.west_bank },
    ];
  }

  private buildRecentActivity(
    subscriptions: Array<{
      id: string;
      status: SubscriptionStatus;
      createdAt: Date;
      updatedAt: Date;
      approvedAt: Date | null;
      rejectedAt: Date | null;
      suspendedAt: Date | null;
      user: { fullName: string };
    }>,
    supportRequests: Array<{
      id: string;
      createdAt: Date;
      user: { fullName: string };
    }>,
  ): DashboardRecentActivity[] {
    const subscriptionActivities: DashboardRecentActivity[] = subscriptions.map(
      (subscription) => ({
        id: `subscription:${subscription.id}`,
        studentName: subscription.user.fullName,
        action:
          SUBSCRIPTION_STATUS_ACTIONS[subscription.status] ??
          'Subscription updated',
        timestamp:
          this.resolveSubscriptionTimestamp(subscription).toISOString(),
      }),
    );

    const supportActivities: DashboardRecentActivity[] = supportRequests.map(
      (request) => ({
        id: `support:${request.id}`,
        studentName: request.user.fullName,
        action: 'Opened support ticket',
        timestamp: request.createdAt.toISOString(),
      }),
    );

    return [...subscriptionActivities, ...supportActivities]
      .sort(
        (left, right) =>
          new Date(right.timestamp).getTime() -
          new Date(left.timestamp).getTime(),
      )
      .slice(0, RECENT_ACTIVITY_LIMIT);
  }

  private resolveSubscriptionTimestamp(subscription: {
    status: SubscriptionStatus;
    createdAt: Date;
    updatedAt: Date;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    suspendedAt: Date | null;
  }): Date {
    switch (subscription.status) {
      case 'active':
        return subscription.approvedAt ?? subscription.updatedAt;
      case 'rejected':
        return subscription.rejectedAt ?? subscription.updatedAt;
      case 'suspended':
        return subscription.suspendedAt ?? subscription.updatedAt;
      case 'pending_review':
      case 'pending_approval':
        return subscription.createdAt;
      default:
        return subscription.updatedAt;
    }
  }

  private toUtcDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
