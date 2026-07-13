jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    subscription = {
      findFirst: jest.fn(),
    };

    lessonVideo = {
      findFirst: jest.fn(),
    };

    videoDownload = {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
  },
}));

jest.mock('../../lib/storage/r2-storage.service', () => ({
  R2StorageService: class MockR2StorageService {
    headObject = jest.fn();
    createSignedGetUrl = jest.fn();
  },
}));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../lib/database/prisma.service';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import { DownloadsService } from './downloads.service';

describe('DownloadsService', () => {
  let downloadsService: DownloadsService;
  let prismaService: PrismaService;
  let r2StorageService: R2StorageService;
  let configService: ConfigService;

  const studentUser = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clerkId: 'user_clerk_123',
    email: 'student@example.com',
    fullName: 'Ahmed Student',
    phoneNumber: '0599000001',
    telegramUsername: 'ahmed_tg',
    region: 'gaza' as const,
    role: 'student' as const,
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  const mobileDevice = {
    deviceType: 'mobile' as const,
    deviceIdentifier: '550e8400-e29b-41d4-a716-446655440099',
    deviceHash: 'hashed-mobile-device',
  };

  const webDevice = {
    deviceType: 'web' as const,
    deviceIdentifier: '550e8400-e29b-41d4-a716-446655440088',
    deviceHash: 'hashed-web-device',
  };

  const lessonVideoId = '550e8400-e29b-41d4-a716-446655440050';
  const downloadedAt = new Date('2026-07-01T10:00:00.000Z');

  const previewLesson = {
    id: '550e8400-e29b-41d4-a716-446655440030',
    chapterId: '550e8400-e29b-41d4-a716-446655440020',
    title: 'Preview Lesson',
    sortOrder: 0,
    accessLevel: 'preview' as const,
    isPublished: true,
    publishedAt: downloadedAt,
    createdAt: downloadedAt,
    updatedAt: downloadedAt,
  };

  const lessonVideo = {
    id: lessonVideoId,
    lessonId: previewLesson.id,
    storageKey: 'videos/preview/video.mp4',
    title: 'Preview Video',
    durationSeconds: 120,
    sortOrder: 0,
    createdAt: downloadedAt,
    updatedAt: downloadedAt,
    lesson: previewLesson,
  };

  beforeEach(() => {
    prismaService = new PrismaService();
    r2StorageService = new R2StorageService(
      { get: jest.fn().mockReturnValue(900) } as unknown as ConfigService,
    );
    configService = {
      get: jest.fn().mockReturnValue(900),
    } as unknown as ConfigService;

    downloadsService = new DownloadsService(
      prismaService,
      r2StorageService,
      configService,
    );

    jest.spyOn(prismaService.subscription, 'findFirst').mockResolvedValue(null);
    jest.spyOn(prismaService.lessonVideo, 'findFirst').mockResolvedValue(lessonVideo);
    jest.spyOn(r2StorageService, 'headObject').mockResolvedValue({
      contentType: 'video/mp4',
      contentLength: 1024,
    });
    jest
      .spyOn(r2StorageService, 'createSignedGetUrl')
      .mockResolvedValue('https://r2.example.com/signed-video');
  });

  describe('authorizeVideoDownload', () => {
    it('rejects web device requests', async () => {
      await expect(
        downloadsService.authorizeVideoDownload(
          studentUser,
          webDevice,
          lessonVideoId,
        ),
      ).rejects.toThrow(
        new ForbiddenException(
          'Video downloads are available on mobile devices only',
        ),
      );
    });

    it('returns a signed URL and creates a download record', async () => {
      jest.spyOn(prismaService.videoDownload, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prismaService.videoDownload, 'create').mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440060',
        userId: studentUser.id,
        lessonVideoId,
        deviceHash: mobileDevice.deviceHash,
        downloadedAt,
        revokedAt: null,
        createdAt: downloadedAt,
        updatedAt: downloadedAt,
      });

      const result = await downloadsService.authorizeVideoDownload(
        studentUser,
        mobileDevice,
        lessonVideoId,
      );

      expect(result.downloadId).toBe('550e8400-e29b-41d4-a716-446655440060');
      expect(result.url).toBe('https://r2.example.com/signed-video');
      expect(result.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(r2StorageService.createSignedGetUrl).toHaveBeenCalledWith({
        key: lessonVideo.storageKey,
        expiresInSeconds: 900,
      });
    });

    it('refreshes an existing active download row', async () => {
      jest.spyOn(prismaService.videoDownload, 'findFirst').mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440060',
        userId: studentUser.id,
        lessonVideoId,
        deviceHash: mobileDevice.deviceHash,
        downloadedAt,
        revokedAt: null,
        createdAt: downloadedAt,
        updatedAt: downloadedAt,
      });
      jest.spyOn(prismaService.videoDownload, 'update').mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440060',
        userId: studentUser.id,
        lessonVideoId,
        deviceHash: mobileDevice.deviceHash,
        downloadedAt: new Date('2026-07-01T11:00:00.000Z'),
        revokedAt: null,
        createdAt: downloadedAt,
        updatedAt: new Date('2026-07-01T11:00:00.000Z'),
      });

      await downloadsService.authorizeVideoDownload(
        studentUser,
        mobileDevice,
        lessonVideoId,
      );

      expect(prismaService.videoDownload.update).toHaveBeenCalled();
      expect(prismaService.videoDownload.create).not.toHaveBeenCalled();
    });

    it('returns 404 for subscriber-only content without an active subscription', async () => {
      jest.spyOn(prismaService.lessonVideo, 'findFirst').mockResolvedValue({
        ...lessonVideo,
        lesson: {
          ...previewLesson,
          accessLevel: 'subscriber_only' as const,
        },
      });

      await expect(
        downloadsService.authorizeVideoDownload(
          studentUser,
          mobileDevice,
          lessonVideoId,
        ),
      ).rejects.toThrow(new NotFoundException('Lesson video not found'));
    });
  });

  describe('listMyDownloads', () => {
    it('returns device-scoped sync state with revocation and access flags', async () => {
      jest.spyOn(prismaService.videoDownload, 'findMany').mockResolvedValue([
        {
          id: '550e8400-e29b-41d4-a716-446655440060',
          userId: studentUser.id,
          lessonVideoId,
          deviceHash: mobileDevice.deviceHash,
          downloadedAt,
          revokedAt: null,
          createdAt: downloadedAt,
          updatedAt: downloadedAt,
          lessonVideo: {
            ...lessonVideo,
            lesson: {
              ...previewLesson,
              chapter: {
                id: '550e8400-e29b-41d4-a716-446655440020',
                unitId: '550e8400-e29b-41d4-a716-446655440010',
                title: 'Chapter One',
                sortOrder: 0,
                isPublished: true,
                publishedAt: downloadedAt,
                createdAt: downloadedAt,
                updatedAt: downloadedAt,
                unit: {
                  id: '550e8400-e29b-41d4-a716-446655440010',
                  title: 'Unit Gaza',
                  description: null,
                  region: 'gaza' as const,
                  sortOrder: 0,
                  isPublished: true,
                  publishedAt: downloadedAt,
                  createdAt: downloadedAt,
                  updatedAt: downloadedAt,
                },
              },
            },
          },
        },
      ]);

      await expect(
        downloadsService.listMyDownloads(studentUser, mobileDevice),
      ).resolves.toEqual({
        downloads: [
          {
            id: '550e8400-e29b-41d4-a716-446655440060',
            lessonVideoId,
            downloadedAt: downloadedAt.toISOString(),
            revokedAt: null,
            isRevoked: false,
            isAccessValid: true,
          },
        ],
      });
    });

    it('marks revoked downloads as invalid for access', async () => {
      const revokedAt = new Date('2026-07-01T12:00:00.000Z');

      jest.spyOn(prismaService.videoDownload, 'findMany').mockResolvedValue([
        {
          id: '550e8400-e29b-41d4-a716-446655440060',
          userId: studentUser.id,
          lessonVideoId,
          deviceHash: mobileDevice.deviceHash,
          downloadedAt,
          revokedAt,
          createdAt: downloadedAt,
          updatedAt: revokedAt,
          lessonVideo: {
            ...lessonVideo,
            lesson: {
              ...previewLesson,
              chapter: {
                id: '550e8400-e29b-41d4-a716-446655440020',
                unitId: '550e8400-e29b-41d4-a716-446655440010',
                title: 'Chapter One',
                sortOrder: 0,
                isPublished: true,
                publishedAt: downloadedAt,
                createdAt: downloadedAt,
                updatedAt: downloadedAt,
                unit: {
                  id: '550e8400-e29b-41d4-a716-446655440010',
                  title: 'Unit Gaza',
                  description: null,
                  region: 'gaza' as const,
                  sortOrder: 0,
                  isPublished: true,
                  publishedAt: downloadedAt,
                  createdAt: downloadedAt,
                  updatedAt: downloadedAt,
                },
              },
            },
          },
        },
      ]);

      const result = await downloadsService.listMyDownloads(
        studentUser,
        mobileDevice,
      );

      expect(result.downloads[0]).toMatchObject({
        revokedAt: revokedAt.toISOString(),
        isRevoked: true,
        isAccessValid: false,
      });
    });
  });

  describe('revokeDownloads', () => {
    it('revokes active downloads for a user and optional device hash', async () => {
      jest
        .spyOn(prismaService.videoDownload, 'updateMany')
        .mockResolvedValue({ count: 1 });

      await downloadsService.revokeDownloads(studentUser.id, {
        deviceHash: mobileDevice.deviceHash,
      });

      expect(prismaService.videoDownload.updateMany).toHaveBeenCalledWith({
        where: {
          userId: studentUser.id,
          revokedAt: null,
          deviceHash: mobileDevice.deviceHash,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });
  });
});
