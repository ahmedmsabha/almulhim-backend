jest.mock('./admin-analytics.service', () => ({
  AdminAnalyticsService: class MockAdminAnalyticsService {},
}));

import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/constants/auth-metadata';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import type { DashboardStats } from './types/admin-dashboard.response';

describe('AdminAnalyticsController', () => {
  let adminAnalyticsController: AdminAnalyticsController;
  let adminAnalyticsService: jest.Mocked<
    Pick<AdminAnalyticsService, 'getDashboard'>
  >;

  const dashboard: DashboardStats = {
    totalStudents: 1,
    activeSubscriptions: 1,
    pendingApprovals: 0,
    openSupportTickets: 0,
    subscriptionGrowth: [],
    regionDistribution: [
      { region: 'gaza', count: 1 },
      { region: 'west_bank', count: 0 },
    ],
    recentActivity: [],
  };

  beforeEach(() => {
    adminAnalyticsService = {
      getDashboard: jest.fn(),
    };
    adminAnalyticsController = new AdminAnalyticsController(
      adminAnalyticsService as unknown as AdminAnalyticsService,
    );
  });

  it('requires the admin role via Roles metadata', () => {
    const reflector = new Reflector();
    const roles = reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      AdminAnalyticsController,
    ]);

    expect(roles).toEqual(['admin']);
  });

  it('delegates dashboard loading to the service', async () => {
    adminAnalyticsService.getDashboard.mockResolvedValue(dashboard);

    await expect(adminAnalyticsController.getDashboard()).resolves.toEqual(
      dashboard,
    );
    expect(adminAnalyticsService.getDashboard).toHaveBeenCalledTimes(1);
  });
});
