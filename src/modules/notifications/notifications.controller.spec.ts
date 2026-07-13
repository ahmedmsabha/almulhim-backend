jest.mock('./notifications.service', () => ({
  NotificationsService: class MockNotificationsService {},
}));

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import type { User } from '../../generated/prisma/client';

describe('NotificationsController', () => {
  let notificationsController: NotificationsController;
  let notificationsService: jest.Mocked<
    Pick<
      NotificationsService,
      | 'listMine'
      | 'getUnreadCount'
      | 'markRead'
      | 'markAllRead'
      | 'registerPushToken'
    >
  >;

  const user = {
    id: '550e8400-e29b-41d4-a716-446655440001',
  } as User;

  beforeEach(() => {
    notificationsService = {
      listMine: jest.fn(),
      getUnreadCount: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
      registerPushToken: jest.fn(),
    };
    notificationsController = new NotificationsController(
      notificationsService as unknown as NotificationsService,
    );
  });

  it('delegates listMine', async () => {
    notificationsService.listMine.mockResolvedValue({
      notifications: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await expect(
      notificationsController.listMine(user, { page: '1' }),
    ).resolves.toEqual({
      notifications: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    expect(notificationsService.listMine).toHaveBeenCalledWith(user, {
      page: '1',
    });
  });

  it('delegates unread count', async () => {
    notificationsService.getUnreadCount.mockResolvedValue({ count: 3 });

    await expect(
      notificationsController.getUnreadCount(user),
    ).resolves.toEqual({ count: 3 });
  });

  it('delegates markRead', async () => {
    const notificationId = '550e8400-e29b-41d4-a716-446655440099';
    notificationsService.markRead.mockResolvedValue({
      id: notificationId,
      type: 'lesson_published',
      entityId: '550e8400-e29b-41d4-a716-446655440030',
      title: 'درس جديد',
      body: 'Lesson',
      isRead: true,
      createdAt: '2026-07-13T08:00:00.000Z',
    });

    await expect(
      notificationsController.markRead(user, notificationId),
    ).resolves.toMatchObject({ isRead: true });
  });

  it('delegates markAllRead', async () => {
    notificationsService.markAllRead.mockResolvedValue({ updated: 2 });

    await expect(notificationsController.markAllRead(user)).resolves.toEqual({
      updated: 2,
    });
  });

  it('delegates registerPushToken', async () => {
    notificationsService.registerPushToken.mockResolvedValue({
      registered: true,
      deviceType: 'mobile',
    });

    await expect(
      notificationsController.registerPushToken(user, {
        pushToken: 'ExponentPushToken[test]',
        deviceType: 'mobile',
      }),
    ).resolves.toEqual({ registered: true, deviceType: 'mobile' });
  });
});
