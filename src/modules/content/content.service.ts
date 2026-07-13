import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { AiProviderService } from '../../lib/ai';
import { PrismaService } from '../../lib/database/prisma.service';
import {
  searchContentSchema,
  type SearchContentInput,
} from './schemas/search-content.schema';
import {
  type ChapterDetailResponse,
  type ContentSearchResponse,
  type ContentTreeResponse,
  type LessonDetailResponse,
  toChapterSummaryResponse,
  toLessonDetailResponse,
  toLessonSummaryResponse,
  toUnitSummaryResponse,
  type UnitDetailResponse,
  type UnitListResponse,
} from './types/content.response';
import { buildUnitVisibilityWhere } from './utils/content-access.utils';

const PUBLISHED_CHAPTER_WHERE = { isPublished: true } as const;

const PUBLISHED_LESSON_WHERE = { isPublished: true } as const;

const CHAPTER_ORDER = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];

const LESSON_ORDER = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];

const UNIT_ORDER = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];

const MEDIA_ORDER = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly aiProviderService: AiProviderService,
  ) {}

  async getTree(user: User): Promise<ContentTreeResponse> {
    const hasActiveSubscription = await this.hasActiveSubscription(user.id);

    try {
      const units = await this.prismaService.unit.findMany({
        where: buildUnitVisibilityWhere(user.region),
        orderBy: UNIT_ORDER,
        include: {
          chapters: {
            where: PUBLISHED_CHAPTER_WHERE,
            orderBy: CHAPTER_ORDER,
            include: {
              lessons: {
                where: PUBLISHED_LESSON_WHERE,
                orderBy: LESSON_ORDER,
              },
            },
          },
        },
      });

      return {
        units: units.map((unit) => ({
          ...toUnitSummaryResponse(unit),
          chapters: unit.chapters.map((chapter) => ({
            ...toChapterSummaryResponse(chapter),
            lessons: chapter.lessons.map((lesson) =>
              toLessonSummaryResponse(lesson, hasActiveSubscription),
            ),
          })),
        })),
      };
    } catch (error) {
      this.logger.error(
        `Failed to load content tree for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async listUnits(user: User): Promise<UnitListResponse> {
    try {
      const units = await this.prismaService.unit.findMany({
        where: buildUnitVisibilityWhere(user.region),
        orderBy: UNIT_ORDER,
      });

      return {
        units: units.map(toUnitSummaryResponse),
      };
    } catch (error) {
      this.logger.error(`Failed to list units for user ${user.id}`, error);
      throw error;
    }
  }

  async getUnit(user: User, unitId: string): Promise<UnitDetailResponse> {
    try {
      const unit = await this.prismaService.unit.findFirst({
        where: {
          id: unitId,
          ...buildUnitVisibilityWhere(user.region),
        },
        include: {
          chapters: {
            where: PUBLISHED_CHAPTER_WHERE,
            orderBy: CHAPTER_ORDER,
          },
        },
      });

      if (!unit) {
        throw new NotFoundException('Unit not found');
      }

      return {
        ...toUnitSummaryResponse(unit),
        chapters: unit.chapters.map(toChapterSummaryResponse),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to load unit ${unitId} for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async getChapter(user: User, chapterId: string): Promise<ChapterDetailResponse> {
    const hasActiveSubscription = await this.hasActiveSubscription(user.id);

    try {
      const chapter = await this.prismaService.chapter.findFirst({
        where: {
          id: chapterId,
          ...PUBLISHED_CHAPTER_WHERE,
          unit: buildUnitVisibilityWhere(user.region),
        },
        include: {
          lessons: {
            where: PUBLISHED_LESSON_WHERE,
            orderBy: LESSON_ORDER,
          },
        },
      });

      if (!chapter) {
        throw new NotFoundException('Chapter not found');
      }

      return {
        ...toChapterSummaryResponse(chapter),
        unitId: chapter.unitId,
        lessons: chapter.lessons.map((lesson) =>
          toLessonSummaryResponse(lesson, hasActiveSubscription),
        ),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to load chapter ${chapterId} for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async getLesson(user: User, lessonId: string): Promise<LessonDetailResponse> {
    const hasActiveSubscription = await this.hasActiveSubscription(user.id);

    try {
      const lesson = await this.prismaService.lesson.findFirst({
        where: {
          id: lessonId,
          ...PUBLISHED_LESSON_WHERE,
          chapter: {
            ...PUBLISHED_CHAPTER_WHERE,
            unit: buildUnitVisibilityWhere(user.region),
          },
        },
        include: {
          videos: {
            orderBy: MEDIA_ORDER,
          },
          pdfs: {
            orderBy: MEDIA_ORDER,
          },
        },
      });

      if (!lesson) {
        throw new NotFoundException('Lesson not found');
      }

      return toLessonDetailResponse(lesson, hasActiveSubscription);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to load lesson ${lessonId} for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async search(input: unknown): Promise<ContentSearchResponse> {
    const validatedInput = this.parseSearchInput(input);

    if (!this.aiProviderService.isContentSearchAiEnabled()) {
      throw new ServiceUnavailableException(
        'Content search AI is disabled. Set CONTENT_SEARCH_AI_ENABLED=true to enable.',
      );
    }

    try {
      const aiResult = await this.aiProviderService.searchContentItems({
        query: validatedInput.query,
        items: validatedInput.items,
      });

      return {
        matchingIds: this.postFilterMatchingIds(
          validatedInput,
          aiResult.matchingIds,
        ),
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      this.logger.error('Content search AI request failed', error);
      throw new ServiceUnavailableException(
        'Content search temporarily unavailable',
      );
    }
  }

  private parseSearchInput(input: unknown): SearchContentInput {
    try {
      return searchContentSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate content search payload', error);
      throw error;
    }
  }

  private postFilterMatchingIds(
    input: SearchContentInput,
    candidateIds: string[],
  ): string[] {
    const allowedIds = new Set(input.items.map((item) => item.id));
    const orderById = new Map(
      input.items.map((item) => [item.id, item.orderIndex]),
    );
    const originalIndexById = new Map(
      input.items.map((item, index) => [item.id, index]),
    );

    const uniqueAllowed = [
      ...new Set(candidateIds.filter((id) => allowedIds.has(id))),
    ];

    uniqueAllowed.sort((left, right) => {
      const orderDiff =
        (orderById.get(left) ?? 0) - (orderById.get(right) ?? 0);
      if (orderDiff !== 0) {
        return orderDiff;
      }

      return (
        (originalIndexById.get(left) ?? 0) -
        (originalIndexById.get(right) ?? 0)
      );
    });

    return uniqueAllowed;
  }

  private async hasActiveSubscription(userId: string): Promise<boolean> {
    try {
      const subscription = await this.prismaService.subscription.findFirst({
        where: {
          userId,
          status: 'active',
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });

      return subscription !== null;
    } catch (error) {
      this.logger.error(
        `Failed to check active subscription for user ${userId}`,
        error,
      );
      throw error;
    }
  }
}
