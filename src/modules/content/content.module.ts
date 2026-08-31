import { Module } from '@nestjs/common';
import { AiModule } from '../../lib/ai';
import { StorageModule } from '../../lib/storage';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminContentController } from './admin-content.controller';
import { AdminContentService } from './admin-content.service';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { PublicContentController } from './public-content.controller';
import { PublicContentService } from './public-content.service';

@Module({
  imports: [StorageModule, AiModule, NotificationsModule, SubscriptionsModule],
  controllers: [
    AdminContentController,
    ContentController,
    PublicContentController,
  ],
  providers: [AdminContentService, ContentService, PublicContentService],
  exports: [AdminContentService, ContentService, PublicContentService],
})
export class ContentModule {}
