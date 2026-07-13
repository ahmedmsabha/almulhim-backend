jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    user = {
      count: jest.fn(),
      groupBy: jest.fn(),
    };
    subscription = {
      count: jest.fn(),
      findMany: jest.fn(),
    };
    supportRequest = {
      count: jest.fn(),
      findMany: jest.fn(),
    };
  },
}));

import { InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../lib/database/prisma.service';
import { AdminAnalyticsService } from './admin-analytics.service';

describe('AdminAnalyticsService', () => {
  let adminAnalyticsService: AdminAnalyticsService;
  let prismaService: PrismaService;

  const now = new Date('2026-07-10T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);

    prismaService = new PrismaService();
    adminAnalyticsService = new AdminAnalyticsService(prismaService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('aggregates dashboard stats from Prisma', async () => {
    jest.spyOn(prismaService.user, 'count').mockResolvedValue(42);
    jest
      .spyOn(prismaService.subscription, 'count')
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(5);
    jest.spyOn(prismaService.supportRequest, 'count').mockResolvedValue(3);
    jest.spyOn(prismaService.user, 'groupBy').mockResolvedValue([
      { region: 'gaza', _count: { _all: 30 }, _min: {}, _max: {}, _avg: {}, _sum: {} },
      {
        region: 'west_bank',
        _count: { _all: 12 },
        _min: {},
        _max: {},
        _avg: {},
        _sum: {},
      },
    ] as never);
    jest
      .spyOn(prismaService.subscription, 'findMany')
      .mockResolvedValueOnce([
        {
          id: 'sub-1',
          status: 'active',
          createdAt: new Date('2026-07-09T10:00:00.000Z'),
          updatedAt: new Date('2026-07-09T11:00:00.000Z'),
          approvedAt: new Date('2026-07-09T11:00:00.000Z'),
          rejectedAt: null,
          suspendedAt: null,
          user: { fullName: 'Ahmad Student' },
        },
      ] as never)
      .mockResolvedValueOnce([
        { createdAt: new Date('2026-07-10T08:00:00.000Z') },
        { createdAt: new Date('2026-07-10T09:00:00.000Z') },
        { createdAt: new Date('2026-07-08T09:00:00.000Z') },
      ] as never);
    jest.spyOn(prismaService.supportRequest, 'findMany').mockResolvedValue([
      {
        id: 'support-1',
        createdAt: new Date('2026-07-10T10:00:00.000Z'),
        user: { fullName: 'Sara Student' },
      },
    ] as never);

    const result = await adminAnalyticsService.getDashboard();

    expect(result.totalStudents).toBe(42);
    expect(result.activeSubscriptions).toBe(18);
    expect(result.pendingApprovals).toBe(5);
    expect(result.openSupportTickets).toBe(3);
    expect(result.regionDistribution).toEqual([
      { region: 'gaza', count: 30 },
      { region: 'west_bank', count: 12 },
    ]);
    expect(result.subscriptionGrowth).toHaveLength(30);
    expect(result.subscriptionGrowth[29]).toEqual({
      date: '2026-07-10',
      count: 2,
    });
    expect(result.subscriptionGrowth[27]).toEqual({
      date: '2026-07-08',
      count: 1,
    });
    expect(result.recentActivity[0]).toEqual({
      id: 'support:support-1',
      studentName: 'Sara Student',
      action: 'Opened support ticket',
      timestamp: '2026-07-10T10:00:00.000Z',
    });
    expect(result.recentActivity[1]).toEqual({
      id: 'subscription:sub-1',
      studentName: 'Ahmad Student',
      action: 'Subscription approved',
      timestamp: '2026-07-09T11:00:00.000Z',
    });
  });

  it('throws InternalServerErrorException when Prisma fails', async () => {
    jest
      .spyOn(prismaService.user, 'count')
      .mockRejectedValue(new Error('db down'));

    await expect(adminAnalyticsService.getDashboard()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
