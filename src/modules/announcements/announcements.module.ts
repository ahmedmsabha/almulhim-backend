import { Module } from '@nestjs/common';
import { StorageModule } from '../../lib/storage';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminAnnouncementsController } from './admin-announcements.controller';
import { AdminAnnouncementsService } from './admin-announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

@Module({
  imports: [StorageModule, NotificationsModule],
  controllers: [AdminAnnouncementsController, AnnouncementsController],
  providers: [AdminAnnouncementsService, AnnouncementsService],
  exports: [AdminAnnouncementsService, AnnouncementsService],
})
export class AnnouncementsModule {}
