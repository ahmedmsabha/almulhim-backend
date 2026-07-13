import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresRegistration } from '../../common/decorators/requires-registration.decorator';
import type { User } from '../../generated/prisma/client';
import { NotificationsService } from './notifications.service';
import type {
  NotificationListResponse,
  NotificationResponse,
  RegisterPushTokenResponse,
  UnreadCountResponse,
} from './types/notification.response';

@Controller('notifications')
@RequiresRegistration({ studentOnly: true })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async listMine(
    @CurrentUser() user: User,
    @Query() query: unknown,
  ): Promise<NotificationListResponse> {
    return this.handleWrite(() =>
      this.notificationsService.listMine(user, query),
    );
  }

  @Get('unread-count')
  async getUnreadCount(
    @CurrentUser() user: User,
  ): Promise<UnreadCountResponse> {
    return this.notificationsService.getUnreadCount(user);
  }

  @Patch('read-all')
  async markAllRead(
    @CurrentUser() user: User,
  ): Promise<{ updated: number }> {
    return this.notificationsService.markAllRead(user);
  }

  @Patch(':id/read')
  async markRead(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) notificationId: string,
  ): Promise<NotificationResponse> {
    return this.notificationsService.markRead(user, notificationId);
  }

  @Post('register-token')
  async registerPushToken(
    @CurrentUser() user: User,
    @Body() body: unknown,
  ): Promise<RegisterPushTokenResponse> {
    return this.handleWrite(() =>
      this.notificationsService.registerPushToken(user, body),
    );
  }

  private async handleWrite<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.flatten(),
        });
      }

      throw error;
    }
  }
}
