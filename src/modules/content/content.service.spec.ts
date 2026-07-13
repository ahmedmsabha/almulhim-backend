jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    user = {
      findUnique: jest.fn(),
    };

    subscription = {
      findFirst: jest.fn(),
    };

    unit = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    };

    chapter = {
      findFirst: jest.fn(),
    };

    lesson = {
      findFirst: jest.fn(),
    };
  },
}));

jest.mock('../../lib/ai', () => ({
  AiProviderService: class MockAiProviderService {
    isContentSearchAiEnabled = jest.fn();
    searchContentItems = jest.fn();
  },
}));

import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AiProviderService } from '../../lib/ai';
import { PrismaService } from '../../lib/database/prisma.service';
import { ContentService } from './content.service';

describe('ContentService', () => {
  let contentService: ContentService;
  let prismaService: PrismaService;
  let aiProviderService: jest.Mocked<
    Pick<AiProviderService, 'isContentSearchAiEnabled' | 'searchContentItems'>
  >;

  const studentUser = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clerkId: 'user_clerk_123',
    email: 'student@example.com',
    fullName: 'Ahmed Student',
    phoneNumber: '0599000001',
    telegramUsername: 'ahmed_tg',
    region: 'gaza' as const,
    role: 'student' as const,
    deactivatedAt: null as Date | null,
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  const gazaUnit = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    title: 'Unit Gaza',
    description: 'Gaza unit description',
    region: 'gaza' as const,
    sortOrder: 0,
    isPublished: true,
    publishedAt: new Date('2026-07-01T08:00:00.000Z'),
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  const bothUnit = {
    ...gazaUnit,
    id: '550e8400-e29b-41d4-a716-446655440011',
    title: 'Unit Both',
    description: 'Both regions unit',
    region: 'both' as const,
    sortOrder: 1,
  };

  const chapter = {
    id: '550e8400-e29b-41d4-a716-446655440020',
    unitId: gazaUnit.id,
    title: 'Chapter One',
    sortOrder: 0,
    isPublished: true,
    publishedAt: new Date('2026-07-01T08:00:00.000Z'),
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  const previewLesson = {
    id: '550e8400-e29b-41d4-a716-446655440030',
    chapterId: chapter.id,
    title: 'Preview Lesson',
    sortOrder: 0,
    accessLevel: 'preview' as const,
    isPublished: true,
    publishedAt: new Date('2026-07-01T08:00:00.000Z'),
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  const subscriberLesson = {
    id: '550e8400-e29b-41d4-a716-446655440031',
    chapterId: chapter.id,
    title: 'Subscriber Lesson',
    sortOrder: 1,
    accessLevel: 'subscriber_only' as const,
    isPublished: true,
    publishedAt: new Date('2026-07-01T08:00:00.000Z'),
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  const lessonVideo = {
    id: '550e8400-e29b-41d4-a716-446655440040',
    lessonId: subscriberLesson.id,
    storageKey: 'videos/lesson-1.mp4',
    title: 'Main Video',
    durationSeconds: 600,
    sortOrder: 0,
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  const lessonPdf = {
    id: '550e8400-e29b-41d4-a716-446655440041',
    lessonId: subscriberLesson.id,
    storageKey: 'pdfs/lesson-1.pdf',
    title: 'Worksheet',
    sortOrder: 0,
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  beforeEach(() => {
    prismaService = new PrismaService();
    aiProviderService = {
      isContentSearchAiEnabled: jest.fn().mockReturnValue(true),
      searchContentItems: jest.fn(),
    };
    contentService = new ContentService(
      prismaService,
      aiProviderService as unknown as AiProviderService,
    );
    jest.clearAllMocks();
    aiProviderService.isContentSearchAiEnabled.mockReturnValue(true);
  });

  describe('listUnits', () => {
    it('returns region-filtered published units', async () => {
      jest
        .spyOn(prismaService.unit, 'findMany')
        .mockResolvedValue([gazaUnit, bothUnit]);

      const result = await contentService.listUnits(studentUser);

      expect(prismaService.unit.findMany).toHaveBeenCalledWith({
        where: {
          isPublished: true,
          OR: [{ region: 'gaza' }, { region: 'both' }],
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });

      expect(result.units).toHaveLength(2);
      expect(result.units[0].title).toBe('Unit Gaza');
      expect(result.units[1].title).toBe('Unit Both');
    });
  });

  describe('getUnit', () => {
    it('returns unit with published chapters', async () => {
      jest.spyOn(prismaService.unit, 'findFirst').mockResolvedValue({
        ...gazaUnit,
        chapters: [chapter],
      });

      const result = await contentService.getUnit(studentUser, gazaUnit.id);

      expect(result.id).toBe(gazaUnit.id);
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].title).toBe('Chapter One');
    });

    it('throws NotFoundException for unavailable unit', async () => {
      jest.spyOn(prismaService.unit, 'findFirst').mockResolvedValue(null);

      await expect(
        contentService.getUnit(studentUser, gazaUnit.id),
      ).rejects.toThrow(new NotFoundException('Unit not found'));
    });
  });

  describe('getChapter', () => {
    beforeEach(() => {
      jest
        .spyOn(prismaService.subscription, 'findFirst')
        .mockResolvedValue(null);
    });

    it('returns chapter with lesson lock flags', async () => {
      jest.spyOn(prismaService.chapter, 'findFirst').mockResolvedValue({
        ...chapter,
        lessons: [previewLesson, subscriberLesson],
      });

      const result = await contentService.getChapter(studentUser, chapter.id);

      expect(result.unitId).toBe(gazaUnit.id);
      expect(result.lessons).toEqual([
        {
          id: previewLesson.id,
          title: 'Preview Lesson',
          sortOrder: 0,
          accessLevel: 'preview',
          isLocked: false,
        },
        {
          id: subscriberLesson.id,
          title: 'Subscriber Lesson',
          sortOrder: 1,
          accessLevel: 'subscriber_only',
          isLocked: true,
        },
      ]);
    });

    it('throws NotFoundException for unavailable chapter', async () => {
      jest.spyOn(prismaService.chapter, 'findFirst').mockResolvedValue(null);

      await expect(
        contentService.getChapter(studentUser, chapter.id),
      ).rejects.toThrow(new NotFoundException('Chapter not found'));
    });
  });

  describe('getLesson', () => {
    it('returns unlocked lesson with media metadata', async () => {
      jest.spyOn(prismaService.subscription, 'findFirst').mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440050',
      } as never);

      jest.spyOn(prismaService.lesson, 'findFirst').mockResolvedValue({
        ...subscriberLesson,
        videos: [lessonVideo],
        pdfs: [lessonPdf],
      });

      const result = await contentService.getLesson(
        studentUser,
        subscriberLesson.id,
      );

      expect(result.isLocked).toBe(false);
      expect(result.videos).toEqual([
        {
          id: lessonVideo.id,
          title: 'Main Video',
          durationSeconds: 600,
          sortOrder: 0,
        },
      ]);
      expect(result.pdfs).toEqual([
        {
          id: lessonPdf.id,
          title: 'Worksheet',
          sortOrder: 0,
        },
      ]);
    });

    it('returns locked lesson with empty media arrays', async () => {
      jest
        .spyOn(prismaService.subscription, 'findFirst')
        .mockResolvedValue(null);

      jest.spyOn(prismaService.lesson, 'findFirst').mockResolvedValue({
        ...subscriberLesson,
        videos: [lessonVideo],
        pdfs: [lessonPdf],
      });

      const result = await contentService.getLesson(
        studentUser,
        subscriberLesson.id,
      );

      expect(result.isLocked).toBe(true);
      expect(result.videos).toEqual([]);
      expect(result.pdfs).toEqual([]);
    });

    it('throws NotFoundException for unavailable lesson', async () => {
      jest
        .spyOn(prismaService.subscription, 'findFirst')
        .mockResolvedValue(null);
      jest.spyOn(prismaService.lesson, 'findFirst').mockResolvedValue(null);

      await expect(
        contentService.getLesson(studentUser, subscriberLesson.id),
      ).rejects.toThrow(new NotFoundException('Lesson not found'));
    });
  });

  describe('getTree', () => {
    it('returns nested tree with lock flags', async () => {
      jest
        .spyOn(prismaService.subscription, 'findFirst')
        .mockResolvedValue(null);
      jest.spyOn(prismaService.unit, 'findMany').mockResolvedValue([
        {
          ...gazaUnit,
          chapters: [
            {
              ...chapter,
              lessons: [previewLesson, subscriberLesson],
            },
          ],
        },
      ]);

      const result = await contentService.getTree(studentUser);

      expect(result.units).toHaveLength(1);
      expect(result.units[0].chapters[0].lessons).toEqual([
        expect.objectContaining({ title: 'Preview Lesson', isLocked: false }),
        expect.objectContaining({ title: 'Subscriber Lesson', isLocked: true }),
      ]);
    });
  });

  describe('subscription access', () => {
    it('unlocks subscriber lessons when subscription is active and not expired', async () => {
      jest.spyOn(prismaService.subscription, 'findFirst').mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440050',
      } as never);

      jest.spyOn(prismaService.chapter, 'findFirst').mockResolvedValue({
        ...chapter,
        lessons: [subscriberLesson],
      });

      const result = await contentService.getChapter(studentUser, chapter.id);

      expect(prismaService.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId: studentUser.id,
          status: 'active',
          expiresAt: { gt: expect.any(Date) },
        },
        select: { id: true },
      });
      expect(result.lessons[0].isLocked).toBe(false);
    });

    it('locks subscriber lessons when subscription is expired', async () => {
      jest
        .spyOn(prismaService.subscription, 'findFirst')
        .mockResolvedValue(null);

      jest.spyOn(prismaService.chapter, 'findFirst').mockResolvedValue({
        ...chapter,
        lessons: [subscriberLesson],
      });

      const result = await contentService.getChapter(studentUser, chapter.id);

      expect(result.lessons[0].isLocked).toBe(true);
    });
  });

  describe('search', () => {
    const items = [
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        title: 'Unit Two',
        type: 'unit' as const,
        orderIndex: 2,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440020',
        title: 'Chapter One',
        type: 'chapter' as const,
        orderIndex: 0,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440030',
        title: 'Lesson One',
        type: 'lesson' as const,
        orderIndex: 1,
      },
    ];

    it('post-filters invented ids and sorts matches by orderIndex', async () => {
      aiProviderService.searchContentItems.mockResolvedValue({
        matchingIds: [
          items[0].id,
          '550e8400-e29b-41d4-a716-446655449999',
          items[2].id,
          items[1].id,
          items[0].id,
        ],
      });

      await expect(
        contentService.search({
          query: 'one',
          items,
        }),
      ).resolves.toEqual({
        matchingIds: [items[1].id, items[2].id, items[0].id],
      });

      expect(aiProviderService.searchContentItems).toHaveBeenCalledWith({
        query: 'one',
        items,
      });
    });

    it('throws ServiceUnavailableException when content search AI is disabled', async () => {
      aiProviderService.isContentSearchAiEnabled.mockReturnValue(false);

      await expect(
        contentService.search({
          query: 'one',
          items,
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(aiProviderService.searchContentItems).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException when AI fails (hard fail for client fallback)', async () => {
      aiProviderService.searchContentItems.mockRejectedValue(
        new Error('Gemini timeout'),
      );

      await expect(
        contentService.search({
          query: 'one',
          items,
        }),
      ).rejects.toThrow(
        new ServiceUnavailableException(
          'Content search temporarily unavailable',
        ),
      );
    });
  });
});
