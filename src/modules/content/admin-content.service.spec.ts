jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    unit = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    chapter = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    lesson = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    lessonVideo = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    lessonPdf = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
  },
}));

jest.mock('../../lib/storage/r2-storage.service', () => ({
  R2StorageService: class MockR2StorageService {
    createSignedPutUrl = jest.fn();
    headObject = jest.fn();
    deleteObject = jest.fn();
  },
}));

jest.mock('../../lib/analytics/analytics.service', () => ({
  AnalyticsService: class MockAnalyticsService {
    captureLessonPublished = jest.fn();
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
import { AdminContentService } from './admin-content.service';

describe('AdminContentService', () => {
  let adminContentService: AdminContentService;
  let prismaService: PrismaService;
  let r2StorageService: R2StorageService;
  let analyticsService: AnalyticsService;
  let notificationsService: NotificationsService;

  const lessonId = '550e8400-e29b-41d4-a716-446655440030';
  const unitId = '550e8400-e29b-41d4-a716-446655440010';
  const adminClerkId = 'admin_clerk_456';
  const publishedAt = new Date('2026-07-01T08:00:00.000Z');

  const unit = {
    id: unitId,
    title: 'Unit One',
    description: 'Description',
    region: 'gaza' as const,
    sortOrder: 0,
    isPublished: false,
    publishedAt: null,
    createdAt: publishedAt,
    updatedAt: publishedAt,
  };

  const chapter = {
    id: '550e8400-e29b-41d4-a716-446655440020',
    unitId,
    title: 'Chapter One',
    sortOrder: 0,
    isPublished: false,
    publishedAt: null,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    lessons: [],
  };

  const lesson = {
    id: lessonId,
    chapterId: chapter.id,
    title: 'Lesson One',
    sortOrder: 0,
    accessLevel: 'subscriber_only' as const,
    isPublished: false,
    publishedAt: null,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    videos: [],
    pdfs: [],
  };

  beforeEach(() => {
    prismaService = new PrismaService({} as never);
    r2StorageService = new R2StorageService({} as never);
    analyticsService = new AnalyticsService({} as never);
    notificationsService = new NotificationsService(
      {} as never,
      {} as never,
    );
    adminContentService = new AdminContentService(
      prismaService,
      r2StorageService,
      analyticsService,
      notificationsService,
    );
    jest.clearAllMocks();
  });

  describe('createUnit', () => {
    it('creates a draft unit', async () => {
      jest.spyOn(prismaService.unit, 'create').mockResolvedValue(unit);

      await expect(
        adminContentService.createUnit({
          title: 'Unit One',
          region: 'gaza',
        }),
      ).resolves.toEqual({
        id: unit.id,
        title: unit.title,
        description: unit.description,
        region: unit.region,
        sortOrder: unit.sortOrder,
        isPublished: false,
        publishedAt: null,
      });
    });
  });

  describe('publishUnit', () => {
    it('sets isPublished and publishedAt', async () => {
      jest.spyOn(prismaService.unit, 'findUnique').mockResolvedValue(unit);
      jest.spyOn(prismaService.unit, 'update').mockResolvedValue({
        ...unit,
        isPublished: true,
        publishedAt,
      });

      await expect(
        adminContentService.publishUnit(unitId),
      ).resolves.toMatchObject({
        isPublished: true,
        publishedAt: publishedAt.toISOString(),
      });
    });

    it('throws when unit does not exist', async () => {
      jest.spyOn(prismaService.unit, 'findUnique').mockResolvedValue(null);

      await expect(
        adminContentService.publishUnit(unitId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('publishLesson', () => {
    it('sets isPublished, captures analytics, and notifies the unit region', async () => {
      jest.spyOn(prismaService.lesson, 'findUnique').mockResolvedValue(lesson);
      jest.spyOn(prismaService.lesson, 'update').mockResolvedValue({
        ...lesson,
        isPublished: true,
        publishedAt,
        chapter: {
          id: chapter.id,
          unitId,
          unit: {
            region: unit.region,
          },
        },
      });

      await expect(
        adminContentService.publishLesson(lessonId, adminClerkId),
      ).resolves.toMatchObject({
        isPublished: true,
        publishedAt: publishedAt.toISOString(),
      });

      expect(analyticsService.captureLessonPublished).toHaveBeenCalledWith(
        adminClerkId,
        {
          lessonId,
          chapterId: chapter.id,
          unitId,
        },
      );
      expect(notificationsService.notifyRegion).toHaveBeenCalledWith({
        region: 'gaza',
        type: 'lesson_published',
        entityId: lessonId,
        title: 'درس جديد',
        body: lesson.title,
      });
    });
  });

  describe('createVideoUploadUrl', () => {
    it('returns a server-generated storage key and presigned URL', async () => {
      jest.spyOn(prismaService.lesson, 'findUnique').mockResolvedValue(lesson);
      jest
        .spyOn(r2StorageService, 'createSignedPutUrl')
        .mockResolvedValue('https://upload.example/video');

      const result = await adminContentService.createVideoUploadUrl(lessonId, {
        contentType: 'video/mp4',
      });

      expect(result.uploadUrl).toBe('https://upload.example/video');
      expect(result.storageKey).toMatch(
        new RegExp(`^videos/${lessonId}/[0-9a-f-]+\\.mp4$`, 'i'),
      );
      expect(result.expiresInSeconds).toBe(15 * 60);
    });
  });

  describe('attachVideo', () => {
    const storageKey = `videos/${lessonId}/550e8400-e29b-41d4-a716-446655440099.mp4`;

    it('rejects storage keys outside the lesson prefix', async () => {
      jest.spyOn(prismaService.lesson, 'findUnique').mockResolvedValue(lesson);

      await expect(
        adminContentService.attachVideo(lessonId, {
          storageKey: 'videos/other-lesson/file.mp4',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a video row after validating the object in storage', async () => {
      jest.spyOn(prismaService.lesson, 'findUnique').mockResolvedValue(lesson);
      jest.spyOn(r2StorageService, 'headObject').mockResolvedValue({
        contentType: 'video/mp4',
        contentLength: 1024,
      });
      jest.spyOn(prismaService.lessonVideo, 'create').mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440040',
        lessonId,
        storageKey,
        title: 'Intro',
        durationSeconds: 120,
        sortOrder: 0,
        createdAt: publishedAt,
        updatedAt: publishedAt,
      });

      await expect(
        adminContentService.attachVideo(lessonId, {
          storageKey,
          title: 'Intro',
          durationSeconds: 120,
        }),
      ).resolves.toEqual({
        id: '550e8400-e29b-41d4-a716-446655440040',
        title: 'Intro',
        durationSeconds: 120,
        sortOrder: 0,
        storageKey,
      });
    });
  });

  describe('attachPdf', () => {
    const storageKey = `pdfs/${lessonId}/550e8400-e29b-41d4-a716-446655440099.pdf`;

    it('rejects missing PDF objects in storage', async () => {
      jest.spyOn(prismaService.lesson, 'findUnique').mockResolvedValue(lesson);
      jest.spyOn(r2StorageService, 'headObject').mockResolvedValue(null);

      await expect(
        adminContentService.attachPdf(lessonId, {
          storageKey,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('deleteVideo', () => {
    const videoId = '550e8400-e29b-41d4-a716-446655440040';
    const storageKey = `videos/${lessonId}/550e8400-e29b-41d4-a716-446655440099.mp4`;

    it('deletes R2 object then DB row', async () => {
      jest.spyOn(prismaService.lessonVideo, 'findUnique').mockResolvedValue({
        id: videoId,
        storageKey,
      } as never);
      jest.spyOn(r2StorageService, 'deleteObject').mockResolvedValue(undefined);
      jest.spyOn(prismaService.lessonVideo, 'delete').mockResolvedValue({
        id: videoId,
      } as never);

      await expect(adminContentService.deleteVideo(videoId)).resolves.toEqual({
        deleted: true,
        id: videoId,
      });

      expect(r2StorageService.deleteObject).toHaveBeenCalledWith(storageKey);
      expect(prismaService.lessonVideo.delete).toHaveBeenCalledWith({
        where: { id: videoId },
      });
    });

    it('still deletes the DB row when R2 delete fails', async () => {
      jest.spyOn(prismaService.lessonVideo, 'findUnique').mockResolvedValue({
        id: videoId,
        storageKey,
      } as never);
      jest
        .spyOn(r2StorageService, 'deleteObject')
        .mockRejectedValue(new Error('R2 unavailable'));
      jest.spyOn(prismaService.lessonVideo, 'delete').mockResolvedValue({
        id: videoId,
      } as never);

      await expect(adminContentService.deleteVideo(videoId)).resolves.toEqual({
        deleted: true,
        id: videoId,
      });

      expect(prismaService.lessonVideo.delete).toHaveBeenCalledWith({
        where: { id: videoId },
      });
    });

    it('throws NotFound when the video does not exist', async () => {
      jest.spyOn(prismaService.lessonVideo, 'findUnique').mockResolvedValue(null);

      await expect(
        adminContentService.deleteVideo(videoId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deletePdf', () => {
    const pdfId = '550e8400-e29b-41d4-a716-446655440050';
    const storageKey = `pdfs/${lessonId}/550e8400-e29b-41d4-a716-446655440099.pdf`;

    it('deletes R2 object then DB row even if R2 fails', async () => {
      jest.spyOn(prismaService.lessonPdf, 'findUnique').mockResolvedValue({
        id: pdfId,
        storageKey,
      } as never);
      jest
        .spyOn(r2StorageService, 'deleteObject')
        .mockRejectedValue(new Error('R2 unavailable'));
      jest.spyOn(prismaService.lessonPdf, 'delete').mockResolvedValue({
        id: pdfId,
      } as never);

      await expect(adminContentService.deletePdf(pdfId)).resolves.toEqual({
        deleted: true,
        id: pdfId,
      });

      expect(r2StorageService.deleteObject).toHaveBeenCalledWith(storageKey);
      expect(prismaService.lessonPdf.delete).toHaveBeenCalledWith({
        where: { id: pdfId },
      });
    });
  });
});
