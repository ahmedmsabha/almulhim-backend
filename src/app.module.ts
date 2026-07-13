import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from './config/app-config.module';
import { ArcjetModule } from './lib/arcjet';
import { ClerkModule } from './lib/clerk';
import { DatabaseModule } from './lib/database';
import { AnalyticsModule as AnalyticsLibModule } from './lib/analytics';
import { StorageModule } from './lib/storage';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ContentModule } from './modules/content/content.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { SupportModule } from './modules/support/support.module';
import { DevicesModule } from './modules/devices/devices.module';
import { DownloadsModule } from './modules/downloads/downloads.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    ClerkModule,
    StorageModule,
    AnalyticsLibModule,
    ArcjetModule,
    AuthModule,
    HealthModule,
    UsersModule,
    SubscriptionsModule,
    ContentModule,
    AnnouncementsModule,
    SupportModule,
    DevicesModule,
    DownloadsModule,
    NotificationsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
