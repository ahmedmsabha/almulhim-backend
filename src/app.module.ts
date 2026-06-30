import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { ArcjetModule } from './lib/arcjet';
import { ClerkModule } from './lib/clerk';
import { DatabaseModule } from './lib/database';
import { PostHogModule } from './lib/posthog';
import { StorageModule } from './lib/storage';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    ClerkModule,
    StorageModule,
    PostHogModule,
    ArcjetModule,
    AuthModule,
    HealthModule,
    UsersModule,
    SubscriptionsModule,
  ],
})
export class AppModule {}
