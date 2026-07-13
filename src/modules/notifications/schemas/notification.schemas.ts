import { z } from 'zod';

export const NOTIFICATION_TYPES = [
  'lesson_published',
  'announcement_published',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListNotificationsQueryInput = z.infer<
  typeof listNotificationsQuerySchema
>;

export const registerPushTokenSchema = z.object({
  pushToken: z.string().trim().min(1).max(512),
  deviceType: z.literal('mobile'),
});

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;
