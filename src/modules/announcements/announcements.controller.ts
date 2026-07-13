import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresRegistration } from '../../common/decorators/requires-registration.decorator';
import type { User } from '../../generated/prisma/client';
import { AnnouncementsService } from './announcements.service';
import type { AnnouncementListResponse } from './types/announcement.response';

@Controller('announcements')
@RequiresRegistration({ studentOnly: true })
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  async list(@CurrentUser() user: User): Promise<AnnouncementListResponse> {
    return this.announcementsService.listForUser(user);
  }
}
