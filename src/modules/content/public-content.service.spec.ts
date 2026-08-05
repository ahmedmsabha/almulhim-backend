jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    lesson = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    };

    unit = {
      findMany: jest.fn(),
    };
  },
}));

jest.mock('../../lib/storage', () => ({
  R2StorageService: class MockR2StorageService {
    objectExists = jest.fn();
    createSignedGetUrl = jest.fn();
  },
}));

import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../lib/database/prisma.service';
import { R2StorageService } from '../../lib/storage';
import { PublicContentService } from './public-content.service';

describe('PublicContentService', () => {
  let publicContentService: PublicContentService;
  let prismaService: PrismaService;
  let r2StorageService: jest.Mocked<
    Pick<R2StorageService, 'objectExists' | 'createSignedGetUrl'>
  >;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  const previewLesson = {
    id: '550e8400-e29b-41d4-a716-446655440101',
    title: 'Preview lesson',
    sortOrder: 0,
    accessLevel: 'preview' as const,
    isPublished: true,
    coverStorageKey: null as string | null,
    publishedAt: new Date('2026-07-01T08:00:00.000Z'),
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
    chapterId: '550e8400-e29b-41d4-a716-446655440021',
    videos: [
      {
        id: '550e8400-e29b-41d4-a716-446655440201',
        title: 'Intro',
        durationSeconds: 120,
        sortOrder: 0,
        storageKey: 'videos/preview.mp4',
        lessonId: '550e8400-e29b-41d4-a716-446655440101',
        createdAt: new Date('2026-07-01T08:00:00.000Z'),
        updatedAt: new Date('2026-07-01T08:00:00.000Z'),
      },
    ],
    chapter: {
      id: '550e8400-e29b-41d4-a716-446655440021',
      title: 'Chapter 1',
      unit: {
        id: '550e8400-e29b-41d4-a716-446655440011',
        title: 'وحدة التأسيس',
      },
    },
  };

  beforeEach(() => {
    prismaService = new PrismaService({} as never);
    r2StorageService = {
      objectExists: jest.fn(),
      createSignedGetUrl: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue(300),
    };

    publicContentService = new PublicContentService(
      prismaService,
      r2StorageService as unknown as R2StorageService,
      configService as unknown as ConfigService,
    );
  });

  describe('listPreviewLessons', () => {
    it('returns published preview lessons with category metadata', async () => {
      jest
        .spyOn(prismaService.lesson, 'findMany')
        .mockResolvedValue([previewLesson] as never);

      await expect(publicContentService.listPreviewLessons()).resolves.toEqual({
        lessons: [
          {
            id: previewLesson.id,
            title: previewLesson.title,
            unitTitle: 'وحدة التأسيس',
            chapterTitle: 'Chapter 1',
            category: 'foundation',
            videoCount: 1,
            totalDurationSeconds: 120,
            primaryVideoId: previewLesson.videos[0].id,
            coverUrl: null,
          },
        ],
      });

      expect(prismaService.lesson.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accessLevel: 'preview',
            isPublished: true,
          }),
        }),
      );
    });
  });

  describe('listCatalog', () => {
    it('returns published unit tree with locked vs preview lessons and no media keys', async () => {
      jest.spyOn(prismaService.unit, 'findMany').mockResolvedValue([
        {
          id: '550e8400-e29b-41d4-a716-446655440011',
          title: 'وحدة التأسيس',
          description: 'Foundation unit',
          sortOrder: 0,
          chapters: [
            {
              id: '550e8400-e29b-41d4-a716-446655440021',
              title: 'Chapter 1',
              sortOrder: 0,
              lessons: [
                {
                  id: '550e8400-e29b-41d4-a716-446655440101',
                  title: 'Preview lesson',
                  sortOrder: 0,
                  accessLevel: 'preview',
                  coverStorageKey: null,
                  _count: { videos: 1, pdfs: 0 },
                },
                {
                  id: '550e8400-e29b-41d4-a716-446655440102',
                  title: 'Locked lesson',
                  sortOrder: 1,
                  accessLevel: 'subscriber_only',
                  coverStorageKey: null,
                  _count: { videos: 2, pdfs: 1 },
                },
              ],
            },
          ],
        },
      ] as never);

      await expect(publicContentService.listCatalog()).resolves.toEqual({
        units: [
          {
            id: '550e8400-e29b-41d4-a716-446655440011',
            title: 'وحدة التأسيس',
            description: 'Foundation unit',
            sortOrder: 0,
            coverUrl: null,
            chapters: [
              {
                id: '550e8400-e29b-41d4-a716-446655440021',
                title: 'Chapter 1',
                sortOrder: 0,
                lessons: [
                  {
                    id: '550e8400-e29b-41d4-a716-446655440101',
                    title: 'Preview lesson',
                    sortOrder: 0,
                    accessLevel: 'preview',
                    isLocked: false,
                    videoCount: 1,
                    pdfCount: 0,
                    coverUrl: null,
                  },
                  {
                    id: '550e8400-e29b-41d4-a716-446655440102',
                    title: 'Locked lesson',
                    sortOrder: 1,
                    accessLevel: 'subscriber_only',
                    isLocked: true,
                    videoCount: 2,
                    pdfCount: 1,
                    coverUrl: null,
                  },
                ],
              },
            ],
          },
        ],
      });

      expect(prismaService.unit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublished: true },
        }),
      );
    });
  });
});
