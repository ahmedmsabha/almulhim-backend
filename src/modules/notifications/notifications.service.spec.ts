jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    user = {
      findMany: jest.fn(),
    };

    notification = {
      createMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };

    deviceBinding = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    };
  },
}));

import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../../lib/database/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let notificationsService: NotificationsService;
  let prismaService: PrismaService;
  let configService: { get: jest.Mock };

  const userId = '550e8400-e29b-41d4-a716-446655440001';
  const student: User = {
    id: userId,
    clerkId: 'user_student',
    email: 'student@example.com',
    fullName: 'Student',
    phoneNumber: '0599000000',
    telegramUsername: 'student',
    region: 'gaza',
    role: 'student',
    deactivatedAt: null,
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  const notification = {
    id: '550e8400-e29b-41d4-a716-446655440099',
    userId,
    type: 'lesson_published',
    entityId: '550e8400-e29b-41d4-a716-446655440030',
    title: 'درس جديد',
    body: 'Lesson One',
    isRead: false,
    createdAt: new Date('2026-07-13T08:00:00.000Z'),
  };

  beforeEach(() => {
    prismaService = new PrismaService({} as never);
    configService = {
      get: jest.fn().mockReturnValue(false),
    };
    notificationsService = new NotificationsService(
      prismaService,
      configService as unknown as ConfigService,
    );
    jest.clearAllMocks();
    configService.get.mockReturnValue(false);
  });

  describe('notifyRegion', () => {
    it('creates notification rows for students in the target region', async () => {
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([
        { id: userId },
      ] as never);
      jest
        .spyOn(prismaService.notification, 'createMany')
        .mockResolvedValue({ count: 1 });

      await notificationsService.notifyRegion({
        region: 'gaza',
        type: 'lesson_published',
        entityId: notification.entityId,
        title: 'درس جديد',
        body: 'Lesson One',
      });

      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'student',
          deactivatedAt: null,
          region: 'gaza',
        },
        select: { id: true },
      });
      expect(prismaService.notification.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId,
            type: 'lesson_published',
            entityId: notification.entityId,
            title: 'درس جديد',
            body: 'Lesson One',
          },
        ],
      });
      expect(prismaService.deviceBinding.findMany).not.toHaveBeenCalled();
    });

    it('targets all active students when region is both', async () => {
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([]);

      await notificationsService.notifyRegion({
        region: 'both',
        type: 'announcement_published',
        entityId: '550e8400-e29b-41d4-a716-446655440010',
        title: 'Update',
        body: 'Body',
      });

      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'student',
          deactivatedAt: null,
        },
        select: { id: true },
      });
      expect(prismaService.notification.createMany).not.toHaveBeenCalled();
    });

    it('swallows errors so publish handlers stay resilient', async () => {
      jest
        .spyOn(prismaService.user, 'findMany')
        .mockRejectedValue(new Error('db down'));

      await expect(
        notificationsService.notifyRegion({
          region: 'gaza',
          type: 'lesson_published',
          entityId: notification.entityId,
          title: 'درس جديد',
          body: 'Lesson One',
        }),
      ).resolves.toBeUndefined();
    });

    it('looks up push tokens when PUSH_NOTIFICATIONS_ENABLED is true', async () => {
      configService.get.mockReturnValue(true);
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([
        { id: userId },
      ] as never);
      jest
        .spyOn(prismaService.notification, 'createMany')
        .mockResolvedValue({ count: 1 });
      jest.spyOn(prismaService.deviceBinding, 'findMany').mockResolvedValue([
        { id: 'binding-1', pushToken: 'ExponentPushToken[test]' },
      ] as never);

      await notificationsService.notifyRegion({
        region: 'gaza',
        type: 'lesson_published',
        entityId: notification.entityId,
        title: 'درس جديد',
        body: 'Lesson One',
      });

      expect(prismaService.deviceBinding.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: [userId] },
          deviceType: 'mobile',
          pushToken: { not: null },
        },
        select: { id: true, pushToken: true },
      });
    });
  });

  describe('listMine', () => {
    it('returns paginated notifications newest first', async () => {
      jest
        .spyOn(prismaService.notification, 'findMany')
        .mockResolvedValue([notification] as never);
      jest.spyOn(prismaService.notification, 'count').mockResolvedValue(1);

      await expect(
        notificationsService.listMine(student, { page: '1', pageSize: '20' }),
      ).resolves.toEqual({
        notifications: [
          {
            id: notification.id,
            type: notification.type,
            entityId: notification.entityId,
            title: notification.title,
            body: notification.body,
            isRead: false,
            createdAt: notification.createdAt.toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    });
  });

  describe('markRead', () => {
    it('marks an owned notification as read', async () => {
      jest
        .spyOn(prismaService.notification, 'findFirst')
        .mockResolvedValue(notification as never);
      jest.spyOn(prismaService.notification, 'update').mockResolvedValue({
        ...notification,
        isRead: true,
      } as never);

      await expect(
        notificationsService.markRead(student, notification.id),
      ).resolves.toMatchObject({ isRead: true });
    });

    it('returns 404 when notification is not owned', async () => {
      jest
        .spyOn(prismaService.notification, 'findFirst')
        .mockResolvedValue(null);

      await expect(
        notificationsService.markRead(student, notification.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('registerPushToken', () => {
    it('updates pushToken on the mobile device binding', async () => {
      jest.spyOn(prismaService.deviceBinding, 'findUnique').mockResolvedValue({
        id: 'binding-1',
        userId,
        deviceType: 'mobile',
      } as never);
      jest
        .spyOn(prismaService.deviceBinding, 'update')
        .mockResolvedValue({} as never);

      await expect(
        notificationsService.registerPushToken(student, {
          pushToken: 'ExponentPushToken[test]',
          deviceType: 'mobile',
        }),
      ).resolves.toEqual({
        registered: true,
        deviceType: 'mobile',
      });

      expect(prismaService.deviceBinding.update).toHaveBeenCalledWith({
        where: { id: 'binding-1' },
        data: { pushToken: 'ExponentPushToken[test]' },
      });
    });

    it('throws when mobile binding is missing', async () => {
      jest
        .spyOn(prismaService.deviceBinding, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        notificationsService.registerPushToken(student, {
          pushToken: 'ExponentPushToken[test]',
          deviceType: 'mobile',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
