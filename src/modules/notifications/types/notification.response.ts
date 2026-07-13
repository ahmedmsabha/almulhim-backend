import type { Notification } from '../../../generated/prisma/client';

export type NotificationResponse = {
  id: string;
  type: string;
  entityId: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export type NotificationListResponse = {
  notifications: NotificationResponse[];
  total: number;
  page: number;
  pageSize: number;
};

export type UnreadCountResponse = {
  count: number;
};

export type RegisterPushTokenResponse = {
  registered: true;
  deviceType: 'mobile';
};

export const toNotificationResponse = (
  notification: Notification,
): NotificationResponse => ({
  id: notification.id,
  type: notification.type,
  entityId: notification.entityId,
  title: notification.title,
  body: notification.body,
  isRead: notification.isRead,
  createdAt: notification.createdAt.toISOString(),
});
