import { Module } from '@nestjs/common';
import { AiModule } from '../../lib/ai';
import { StorageModule } from '../../lib/storage';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminContentController } from './admin-content.controller';
import { AdminContentService } from './admin-content.service';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [StorageModule, AiModule, NotificationsModule],
  controllers: [AdminContentController, ContentController],
  providers: [AdminContentService, ContentService],
  exports: [AdminContentService, ContentService],
})
export class ContentModule {}
