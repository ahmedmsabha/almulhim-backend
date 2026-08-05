import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.schema';
import { PrismaService } from '../../lib/database/prisma.service';
import { R2StorageService } from '../../lib/storage';
import type {
  PublicCatalogLesson,
  PublicCatalogResponse,
} from './types/public-catalog.response';
import type {
  PublicPreviewCategory,
  PublicPreviewLessonDetailResponse,
  PublicPreviewLessonListResponse,
  PublicPreviewLessonSummary,
} from './types/public-preview.response';
import { createLessonCoverUrl } from './utils/lesson-cover-url';

const MEDIA_ORDER = [
  { sortOrder: 'asc' as const },
  { createdAt: 'asc' as const },
];

const LESSON_ORDER = [
  { sortOrder: 'asc' as const },
  { createdAt: 'asc' as const },
];

const CHAPTER_ORDER = [
  { sortOrder: 'asc' as const },
  { createdAt: 'asc' as const },
];

const UNIT_ORDER = [
  { sortOrder: 'asc' as const },
  { createdAt: 'asc' as const },
];

const PUBLISHED_CHAPTER_WHERE = { isPublished: true } as const;
const PUBLISHED_LESSON_WHERE = { isPublished: true } as const;

@Injectable()
export class PublicContentService {
  private readonly logger = new Logger(PublicContentService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async listPreviewLessons(): Promise<PublicPreviewLessonListResponse> {
    try {
      const lessons = await this.prismaService.lesson.findMany({
        where: {
          accessLevel: 'preview',
          isPublished: true,
          chapter: {
            isPublished: true,
            unit: {
              isPublished: true,
            },
          },
        },
        orderBy: LESSON_ORDER,
        include: {
          videos: {
            orderBy: MEDIA_ORDER,
          },
          chapter: {
            include: {
              unit: true,
            },
          },
        },
      });

      return {
        lessons: await Promise.all(
          lessons.map(async (lesson) =>
            this.toSummary({
              id: lesson.id,
              title: lesson.title,
              unitTitle: lesson.chapter.unit.title,
              chapterTitle: lesson.chapter.title,
              videos: lesson.videos,
              coverUrl: await createLessonCoverUrl(
                this.r2StorageService,
                lesson.coverStorageKey,
              ),
            }),
          ),
        ),
      };
    } catch (error) {
      this.logger.error('Failed to list public preview lessons', error);
      throw error;
    }
  }

  async listCatalog(): Promise<PublicCatalogResponse> {
    try {
      const units = await this.prismaService.unit.findMany({
        where: { isPublished: true },
        orderBy: UNIT_ORDER,
        include: {
          chapters: {
            where: PUBLISHED_CHAPTER_WHERE,
            orderBy: CHAPTER_ORDER,
            include: {
              lessons: {
                where: PUBLISHED_LESSON_WHERE,
                orderBy: LESSON_ORDER,
                include: {
                  _count: {
                    select: {
                      videos: true,
                      pdfs: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return {
        units: await Promise.all(
          units.map(async (unit) => {
            const chapters = await Promise.all(
              unit.chapters.map(async (chapter) => ({
                id: chapter.id,
                title: chapter.title,
                sortOrder: chapter.sortOrder,
                lessons: await Promise.all(
                  chapter.lessons.map(async (lesson): Promise<PublicCatalogLesson> => {
                    const isLocked = lesson.accessLevel !== 'preview';
                    const coverUrl = await createLessonCoverUrl(
                      this.r2StorageService,
                      lesson.coverStorageKey,
                    );

                    return {
                      id: lesson.id,
                      title: lesson.title,
                      sortOrder: lesson.sortOrder,
                      accessLevel: lesson.accessLevel,
                      isLocked,
                      videoCount: lesson._count.videos,
                      pdfCount: lesson._count.pdfs,
                      coverUrl,
                    };
                  }),
                ),
              })),
            );

            const coverUrl =
              chapters
                .flatMap((chapter) => chapter.lessons)
                .find((lesson) => lesson.coverUrl)?.coverUrl ?? null;

            return {
              id: unit.id,
              title: unit.title,
              description: unit.description,
              sortOrder: unit.sortOrder,
              coverUrl,
              chapters,
            };
          }),
        ),
      };
    } catch (error) {
      this.logger.error('Failed to list public content catalog', error);
      throw error;
    }
  }

  async getPreviewLesson(
    lessonId: string,
  ): Promise<PublicPreviewLessonDetailResponse> {
    try {
      const lesson = await this.prismaService.lesson.findFirst({
        where: {
          id: lessonId,
          accessLevel: 'preview',
          isPublished: true,
          chapter: {
            isPublished: true,
            unit: {
              isPublished: true,
            },
          },
        },
        include: {
          videos: {
            orderBy: MEDIA_ORDER,
          },
          chapter: {
            include: {
              unit: true,
            },
          },
        },
      });

      if (!lesson) {
        throw new NotFoundException('Preview lesson not found');
      }

      const summary = this.toSummary({
        id: lesson.id,
        title: lesson.title,
        unitTitle: lesson.chapter.unit.title,
        chapterTitle: lesson.chapter.title,
        videos: lesson.videos,
        coverUrl: await createLessonCoverUrl(
          this.r2StorageService,
          lesson.coverStorageKey,
        ),
      });

      const primaryVideo = lesson.videos[0] ?? null;
      let playbackUrl: string | null = null;
      let playbackExpiresInSeconds: number | null = null;

      if (primaryVideo) {
        const expiresInSeconds = this.configService.get(
          'SIGNED_URL_TTL_SECONDS',
          { infer: true },
        );
        const exists = await this.r2StorageService.objectExists(
          primaryVideo.storageKey,
        );

        if (exists) {
          playbackUrl = await this.r2StorageService.createSignedGetUrl({
            key: primaryVideo.storageKey,
            expiresInSeconds,
          });
          playbackExpiresInSeconds = expiresInSeconds;
        }
      }

      return {
        ...summary,
        videos: lesson.videos.map((video) => ({
          id: video.id,
          title: video.title,
          durationSeconds: video.durationSeconds,
          sortOrder: video.sortOrder,
        })),
        playbackUrl,
        playbackExpiresInSeconds,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to load public preview lesson ${lessonId}`,
        error,
      );
      throw error;
    }
  }

  private toSummary(input: {
    id: string;
    title: string;
    unitTitle: string;
    chapterTitle: string;
    videos: Array<{
      id: string;
      durationSeconds: number | null;
    }>;
    coverUrl: string | null;
  }): PublicPreviewLessonSummary {
    const durations = input.videos
      .map((video) => video.durationSeconds)
      .filter((value): value is number => typeof value === 'number');

    return {
      id: input.id,
      title: input.title,
      unitTitle: input.unitTitle,
      chapterTitle: input.chapterTitle,
      category: this.inferCategory(input.unitTitle, input.chapterTitle),
      videoCount: input.videos.length,
      totalDurationSeconds:
        durations.length > 0
          ? durations.reduce((sum, value) => sum + value, 0)
          : null,
      primaryVideoId: input.videos[0]?.id ?? null,
      coverUrl: input.coverUrl,
    };
  }

  private inferCategory(
    unitTitle: string,
    chapterTitle: string,
  ): PublicPreviewCategory {
    const haystack = `${unitTitle} ${chapterTitle}`.toLowerCase();

    if (
      haystack.includes('تأسيس') ||
      haystack.includes('تاسيس') ||
      haystack.includes('foundation')
    ) {
      return 'foundation';
    }

    if (
      haystack.includes('منهاج') ||
      haystack.includes('منهج') ||
      haystack.includes('curriculum')
    ) {
      return 'curriculum';
    }

    return 'other';
  }
}
