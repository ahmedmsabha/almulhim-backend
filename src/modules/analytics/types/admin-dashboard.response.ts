export type DashboardRegion = 'gaza' | 'west_bank';

export interface DashboardSubscriptionGrowthPoint {
  date: string;
  count: number;
}

export interface DashboardRegionDistribution {
  region: DashboardRegion;
  count: number;
}

export interface DashboardRecentActivity {
  id: string;
  studentName: string;
  action: string;
  timestamp: string;
}

export interface DashboardStats {
  totalStudents: number;
  activeSubscriptions: number;
  pendingApprovals: number;
  openSupportTickets: number;
  subscriptionGrowth: DashboardSubscriptionGrowthPoint[];
  regionDistribution: DashboardRegionDistribution[];
  recentActivity: DashboardRecentActivity[];
}
