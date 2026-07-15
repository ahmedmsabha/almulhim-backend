import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZodError } from 'zod';
import type { AppEnv } from '../../config/env.schema';
import type { ContentRegion, User } from '../../generated/prisma/client';
import { PrismaService } from '../../lib/database/prisma.service';
import {
  ExpoPushSender,
  type ExpoPushMessage,
  type ExpoPushTicket,
} from './expo-push.sender';
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

type PushRecipient = {
  bindingId: string;
  pushToken: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expoPushSender: ExpoPushSender;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService<AppEnv, true>,
    @Optional() expoPushSender?: ExpoPushSender,
  ) {
    this.expoPushSender = expoPushSender ?? new ExpoPushSender();
  }

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

      const recipients: PushRecipient[] = [];
      for (const binding of bindings) {
        if (!binding.pushToken) {
          continue;
        }
        if (!this.expoPushSender.isExpoPushToken(binding.pushToken)) {
          this.logger.warn(
            `Skipping invalid Expo push token on binding ${binding.id}`,
          );
          continue;
        }
        recipients.push({
          bindingId: binding.id,
          pushToken: binding.pushToken,
        });
      }

      if (recipients.length === 0) {
        return;
      }

      await this.sendExpoPushes(recipients, params);
    } catch (error) {
      // Must stay visible in Nest logs — publish still succeeds when this path fails.
      this.logger.error(
        'notifyRegion failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Sends Expo push messages in SDK-sized chunks. Clears pushToken on
   * DeviceNotRegistered so later publishes skip dead tokens.
   */
  private async sendExpoPushes(
    recipients: PushRecipient[],
    params: NotifyRegionParams,
  ): Promise<void> {
    const messages: ExpoPushMessage[] = recipients.map((recipient) => ({
      to: recipient.pushToken,
      title: params.title,
      body: params.body,
      sound: 'default',
      channelId: 'default',
      data: {
        type: params.type,
        entityId: params.entityId,
      },
    }));

    const chunks = this.expoPushSender.chunkPushNotifications(messages);
    let messageOffset = 0;

    for (const chunk of chunks) {
      let tickets: ExpoPushTicket[];
      try {
        tickets = await this.expoPushSender.sendPushNotificationsAsync(chunk);
      } catch (error) {
        this.logger.error(
          `Failed to send Expo push chunk for ${params.type} ${params.entityId}`,
          error instanceof Error ? error.stack : String(error),
        );
        messageOffset += chunk.length;
        continue;
      }

      for (let index = 0; index < tickets.length; index += 1) {
        const ticket = tickets[index];
        const recipient = recipients[messageOffset + index];
        if (!ticket || !recipient) {
          continue;
        }

        if (ticket.status === 'ok') {
          continue;
        }

        this.logger.warn(
          `Expo push ticket error for binding ${recipient.bindingId}: ${ticket.message}`,
        );

        if (ticket.details?.error === 'DeviceNotRegistered') {
          try {
            await this.prismaService.deviceBinding.update({
              where: { id: recipient.bindingId },
              data: { pushToken: null },
            });
          } catch (error) {
            this.logger.error(
              `Failed to clear stale push token on binding ${recipient.bindingId}`,
              error instanceof Error ? error.stack : String(error),
            );
          }
        }
      }

      messageOffset += chunk.length;
    }

    this.logger.debug(
      `Expo push sent to ${recipients.length} device(s) for ${params.type} ${params.entityId}`,
    );
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
      this.logger.error(
        'Failed to validate register push token payload',
        error,
      );
      throw error;
    }
  }
}
