import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZodError } from 'zod';
import type { AppEnv } from '../../config/env.schema';
import type { ContentRegion, User } from '../../generated/prisma/client';
import { PrismaService } from '../../lib/database/prisma.service';
import {
  listNotificationsQuerySchema,
  registerPushTokenSchema,
  type ListNotificationsQueryInput,
  type NotificationType,
  type RegisterPushTokenInput,
} from './schemas/notification.schemas';
import {
  toNotificationResponse,
  type NotificationListResponse,
  type NotificationResponse,
  type RegisterPushTokenResponse,
  type UnreadCountResponse,
} from './types/notification.response';

export type NotifyRegionParams = {
  region: ContentRegion;
  type: NotificationType;
  entityId: string;
  title: string;
  body: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  /**
   * Creates in-app notification rows for matching students and optionally
   * queues push delivery. Never throws — publish handlers must stay resilient.
   *
   * Region targeting (inverse of content visibility):
   * - `gaza` / `west_bank` → students in that region only
   * - `both` → all active students
   * Deactivated students are excluded.
   */
  async notifyRegion(params: NotifyRegionParams): Promise<void> {
    try {
      const students = await this.prismaService.user.findMany({
        where: {
          role: 'student',
          deactivatedAt: null,
          ...(params.region === 'both' ? {} : { region: params.region }),
        },
        select: { id: true },
      });

      if (students.length === 0) {
        return;
      }

      await this.prismaService.notification.createMany({
        data: students.map((student) => ({
          userId: student.id,
          type: params.type,
          entityId: params.entityId,
          title: params.title,
          body: params.body,
        })),
      });

      const pushEnabled = this.configService.get('PUSH_NOTIFICATIONS_ENABLED', {
        infer: true,
      });

      if (!pushEnabled) {
        return;
      }

      const bindings = await this.prismaService.deviceBinding.findMany({
        where: {
          userId: { in: students.map((student) => student.id) },
          deviceType: 'mobile',
          pushToken: { not: null },
        },
        select: { id: true, pushToken: true },
      });

      if (bindings.length === 0) {
        return;
      }

      // TODO: batch via expo-server-sdk once Mobile registers real Expo push tokens.
      // Package `expo-server-sdk` is installed; do not wire chunked send until
      // end-to-end testing against a real device is possible.
      this.logger.debug(
        `Push stub: ${bindings.length} mobile token(s) ready for ${params.type} ${params.entityId}`,
      );
    } catch (error) {
      this.logger.error('notifyRegion failed', error);
    }
  }

  async listMine(
    user: User,
    query: unknown,
  ): Promise<NotificationListResponse> {
    const validatedQuery = this.parseListQuery(query);
    const skip = (validatedQuery.page - 1) * validatedQuery.pageSize;

    try {
      const [notifications, total] = await Promise.all([
        this.prismaService.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          skip,
          take: validatedQuery.pageSize,
        }),
        this.prismaService.notification.count({
          where: { userId: user.id },
        }),
      ]);

      return {
        notifications: notifications.map(toNotificationResponse),
        total,
        page: validatedQuery.page,
        pageSize: validatedQuery.pageSize,
      };
    } catch (error) {
      this.logger.error(
        `Failed to list notifications for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async getUnreadCount(user: User): Promise<UnreadCountResponse> {
    try {
      const count = await this.prismaService.notification.count({
        where: {
          userId: user.id,
          isRead: false,
        },
      });

      return { count };
    } catch (error) {
      this.logger.error(
        `Failed to count unread notifications for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async markRead(
    user: User,
    notificationId: string,
  ): Promise<NotificationResponse> {
    try {
      const notification = await this.prismaService.notification.findFirst({
        where: {
          id: notificationId,
          userId: user.id,
        },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      if (notification.isRead) {
        return toNotificationResponse(notification);
      }

      const updated = await this.prismaService.notification.update({
        where: { id: notification.id },
        data: { isRead: true },
      });

      return toNotificationResponse(updated);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to mark notification ${notificationId} read for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async markAllRead(user: User): Promise<{ updated: number }> {
    try {
      const result = await this.prismaService.notification.updateMany({
        where: {
          userId: user.id,
          isRead: false,
        },
        data: { isRead: true },
      });

      return { updated: result.count };
    } catch (error) {
      this.logger.error(
        `Failed to mark all notifications read for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async registerPushToken(
    user: User,
    input: unknown,
  ): Promise<RegisterPushTokenResponse> {
    const validatedInput = this.parseRegisterPushTokenInput(input);

    try {
      const binding = await this.prismaService.deviceBinding.findUnique({
        where: {
          userId_deviceType: {
            userId: user.id,
            deviceType: validatedInput.deviceType,
          },
        },
      });

      if (!binding) {
        throw new NotFoundException(
          'Mobile device binding not found. Bind a device before registering a push token.',
        );
      }

      await this.prismaService.deviceBinding.update({
        where: { id: binding.id },
        data: { pushToken: validatedInput.pushToken },
      });

      return {
        registered: true,
        deviceType: validatedInput.deviceType,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ZodError) {
        throw error;
      }

      this.logger.error(
        `Failed to register push token for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  private parseListQuery(query: unknown): ListNotificationsQueryInput {
    try {
      return listNotificationsQuerySchema.parse(query);
    } catch (error) {
      this.logger.error('Failed to validate list notifications query', error);
      throw error;
    }
  }

  private parseRegisterPushTokenInput(input: unknown): RegisterPushTokenInput {
    try {
      return registerPushTokenSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate register push token payload', error);
      throw error;
    }
  }
}
