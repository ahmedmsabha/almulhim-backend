import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAnalyticsService } from './admin-analytics.service';
import type { DashboardStats } from './types/admin-dashboard.response';

@Roles('admin')
@Controller('analytics/admin')
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get('dashboard')
  async getDashboard(): Promise<DashboardStats> {
    return this.adminAnalyticsService.getDashboard();
  }
}
