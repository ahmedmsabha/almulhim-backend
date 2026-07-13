jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    announcement = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
  },
}));

jest.mock('../../lib/storage/r2-storage.service', () => ({
  R2StorageService: class MockR2StorageService {
    createSignedPutUrl = jest.fn();
    headObject = jest.fn();
  },
}));

jest.mock('../../lib/analytics/analytics.service', () => ({
  AnalyticsService: class MockAnalyticsService {
    captureAnnouncementPublished = jest.fn();
  },
}));

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class MockNotificationsService {
    notifyRegion = jest.fn().mockResolvedValue(undefined);
  },
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnalyticsService } from '../../lib/analytics/analytics.service';
import { PrismaService } from '../../lib/database/prisma.service';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminAnnouncementsService } from './admin-announcements.service';

describe('AdminAnnouncementsService', () => {
  let adminAnnouncementsService: AdminAnnouncementsService;
  let prismaService: PrismaService;
  let r2StorageService: R2StorageService;
  let analyticsService: AnalyticsService;
  let notificationsService: NotificationsService;

  const announcementId = '550e8400-e29b-41d4-a716-446655440010';
  const adminClerkId = 'admin_clerk_456';
  const timestamp = new Date('2026-07-01T08:00:00.000Z');

  const announcement = {
    id: announcementId,
    title: 'Update',
    body: 'Body text',
    region: 'gaza' as const,
    imageStorageKey: null,
    isPublished: false,
    publishedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  beforeEach(() => {
    prismaService = new PrismaService();
    r2StorageService = new R2StorageService({} as never);
    analyticsService = new AnalyticsService({} as never);
    notificationsService = new NotificationsService({} as never, {} as never);
    adminAnnouncementsService = new AdminAnnouncementsService(
      prismaService,
      r2StorageService,
      analyticsService,
      notificationsService,
    );
    jest.clearAllMocks();
  });

  it('creates a draft announcement', async () => {
    jest
      .spyOn(prismaService.announcement, 'create')
      .mockResolvedValue(announcement);

    const result = await adminAnnouncementsService.create({
      title: 'Update',
      body: 'Body text',
      region: 'gaza',
    });

    expect(result).toMatchObject({
      title: 'Update',
      isPublished: false,
    });
  });

  it('publishes an announcement and notifies the region', async () => {
    jest
      .spyOn(prismaService.announcement, 'findUnique')
      .mockResolvedValue(announcement);
    jest.spyOn(prismaService.announcement, 'update').mockResolvedValue({
      ...announcement,
      isPublished: true,
      publishedAt: timestamp,
    });

    const result = await adminAnnouncementsService.publish(
      announcementId,
      adminClerkId,
    );

    expect(result.isPublished).toBe(true);
    expect(result.publishedAt).toBe(timestamp.toISOString());
    expect(analyticsService.captureAnnouncementPublished).toHaveBeenCalledWith(
      adminClerkId,
      {
        announcementId,
        region: 'gaza',
      },
    );
    expect(notificationsService.notifyRegion).toHaveBeenCalledWith({
      region: 'gaza',
      type: 'announcement_published',
      entityId: announcementId,
      title: announcement.title,
      body: announcement.body.slice(0, 100),
    });
  });

  it('rejects invalid image storage keys on attach', async () => {
    jest
      .spyOn(prismaService.announcement, 'findUnique')
      .mockResolvedValue(announcement);

    await expect(
      adminAnnouncementsService.attachImage(announcementId, {
        storageKey: 'invalid/key.jpg',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when announcement is missing', async () => {
    jest
      .spyOn(prismaService.announcement, 'findUnique')
      .mockResolvedValue(null);

    await expect(
      adminAnnouncementsService.getById(announcementId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
