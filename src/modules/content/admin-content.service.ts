import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AnalyticsService } from '../../lib/analytics/analytics.service';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import { PrismaService } from '../../lib/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CONTENT_UPLOAD_EXPIRES_SECONDS,
  PDF_CONTENT_TYPE_EXTENSION,
  PDF_KEY_PREFIX,
  VIDEO_CONTENT_TYPE_EXTENSION,
  VIDEO_KEY_PREFIX,
  buildPdfStorageKeyPattern,
  buildVideoStorageKeyPattern,
  type AllowedPdfContentType,
  type AllowedVideoContentType,
} from './constants/content-upload.constants';
import {
  attachPdfSchema,
  type AttachPdfInput,
} from './schemas/attach-pdf.schema';
import {
  attachVideoSchema,
  type AttachVideoInput,
} from './schemas/attach-video.schema';
import {
  createChapterSchema,
  type CreateChapterInput,
} from './schemas/create-chapter.schema';
import {
  createLessonSchema,
  type CreateLessonInput,
} from './schemas/create-lesson.schema';
import {
  createPdfUploadUrlSchema,
  type CreatePdfUploadUrlInput,
} from './schemas/create-pdf-upload-url.schema';
import {
  createUnitSchema,
  type CreateUnitInput,
} from './schemas/create-unit.schema';
import {
  createVideoUploadUrlSchema,
  type CreateVideoUploadUrlInput,
} from './schemas/create-video-upload-url.schema';
import {
  updateChapterSchema,
  type UpdateChapterInput,
} from './schemas/update-chapter.schema';
import {
  updateLessonSchema,
  type UpdateLessonInput,
} from './schemas/update-lesson.schema';
import {
  updatePdfSchema,
  type UpdatePdfInput,
} from './schemas/update-pdf.schema';
import {
  updateUnitSchema,
  type UpdateUnitInput,
} from './schemas/update-unit.schema';
import {
  updateVideoSchema,
  type UpdateVideoInput,
} from './schemas/update-video.schema';
import {
  toAdminChapterSummaryResponse,
  toAdminLessonDetailResponse,
  toAdminLessonSummaryResponse,
  toAdminPdfResponse,
  toAdminUnitSummaryResponse,
  toAdminVideoResponse,
  type AdminChapterDetailResponse,
  type AdminContentTreeResponse,
  type AdminLessonDetailResponse,
  type AdminPdfResponse,
  type AdminUnitDetailResponse,
  type AdminUnitSummaryResponse,
  type AdminVideoResponse,
  type MediaUploadUrlResponse,
} from './types/admin-content.response';
import {
  lessonMediaValidationErrorMessage,
  validatePdfObjectMetadata,
  validateVideoObjectMetadata,
} from './utils/lesson-media-object.validation';

const CHAPTER_ORDER = [
  { sortOrder: 'asc' as const },
  { createdAt: 'asc' as const },
];

const LESSON_ORDER = [
  { sortOrder: 'asc' as const },
  { createdAt: 'asc' as const },
];

const UNIT_ORDER = [
  { sortOrder: 'asc' as const },
  { createdAt: 'asc' as const },
];

const MEDIA_ORDER = [
  { sortOrder: 'asc' as const },
  { createdAt: 'asc' as const },
];

@Injectable()
export class AdminContentService {
  private readonly logger = new Logger(AdminContentService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
    private readonly analyticsService: AnalyticsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getTree(): Promise<AdminContentTreeResponse> {
    try {
      const units = await this.prismaService.unit.findMany({
        orderBy: UNIT_ORDER,
        include: {
          chapters: {
            orderBy: CHAPTER_ORDER,
            include: {
              lessons: {
                orderBy: LESSON_ORDER,
              },
            },
          },
        },
      });

      return {
        units: units.map((unit) => ({
          ...toAdminUnitSummaryResponse(unit),
          chapters: unit.chapters.map((chapter) => ({
            ...toAdminChapterSummaryResponse(chapter),
            lessons: chapter.lessons.map(toAdminLessonSummaryResponse),
          })),
        })),
      };
    } catch (error) {
      this.logger.error('Failed to load admin content tree', error);
      throw error;
    }
  }

  async getUnit(unitId: string): Promise<AdminUnitDetailResponse> {
    try {
      const unit = await this.prismaService.unit.findUnique({
        where: { id: unitId },
        include: {
          chapters: {
            orderBy: CHAPTER_ORDER,
          },
        },
      });

      if (!unit) {
        throw new NotFoundException('Unit not found');
      }

      return {
        ...toAdminUnitSummaryResponse(unit),
        chapters: unit.chapters.map(toAdminChapterSummaryResponse),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to load admin unit ${unitId}`, error);
      throw error;
    }
  }

  async getChapter(chapterId: string): Promise<AdminChapterDetailResponse> {
    try {
      const chapter = await this.prismaService.chapter.findUnique({
        where: { id: chapterId },
        include: {
          lessons: {
            orderBy: LESSON_ORDER,
          },
        },
      });

      if (!chapter) {
        throw new NotFoundException('Chapter not found');
      }

      return {
        ...toAdminChapterSummaryResponse(chapter),
        unitId: chapter.unitId,
        lessons: chapter.lessons.map(toAdminLessonSummaryResponse),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to load admin chapter ${chapterId}`, error);
      throw error;
    }
  }

  async getLesson(lessonId: string): Promise<AdminLessonDetailResponse> {
    try {
      const lesson = await this.prismaService.lesson.findUnique({
        where: { id: lessonId },
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

      return toAdminLessonDetailResponse(lesson);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to load admin lesson ${lessonId}`, error);
      throw error;
    }
  }

  async createUnit(input: unknown): Promise<AdminUnitSummaryResponse> {
    const validatedInput = this.parseCreateUnitInput(input);

    try {
      const unit = await this.prismaService.unit.create({
        data: {
          title: validatedInput.title,
          description: validatedInput.description,
          region: validatedInput.region,
          sortOrder: validatedInput.sortOrder,
        },
      });

      return toAdminUnitSummaryResponse(unit);
    } catch (error) {
      this.logger.error('Failed to create unit', error);
      throw error;
    }
  }

  async updateUnit(
    unitId: string,
    input: unknown,
  ): Promise<AdminUnitSummaryResponse> {
    const validatedInput = this.parseUpdateUnitInput(input);
    await this.assertUnitExists(unitId);

    try {
      const unit = await this.prismaService.unit.update({
        where: { id: unitId },
        data: validatedInput,
      });

      return toAdminUnitSummaryResponse(unit);
    } catch (error) {
      this.logger.error(`Failed to update unit ${unitId}`, error);
      throw error;
    }
  }

  async publishUnit(unitId: string): Promise<AdminUnitSummaryResponse> {
    await this.assertUnitExists(unitId);

    try {
      const unit = await this.prismaService.unit.update({
        where: { id: unitId },
        data: {
          isPublished: true,
          publishedAt: new Date(),
        },
      });

      return toAdminUnitSummaryResponse(unit);
    } catch (error) {
      this.logger.error(`Failed to publish unit ${unitId}`, error);
      throw error;
    }
  }

  async unpublishUnit(unitId: string): Promise<AdminUnitSummaryResponse> {
    await this.assertUnitExists(unitId);

    try {
      const unit = await this.prismaService.unit.update({
        where: { id: unitId },
        data: { isPublished: false },
      });

      return toAdminUnitSummaryResponse(unit);
    } catch (error) {
      this.logger.error(`Failed to unpublish unit ${unitId}`, error);
      throw error;
    }
  }

  async createChapter(
    unitId: string,
    input: unknown,
  ): Promise<AdminChapterDetailResponse> {
    const validatedInput = this.parseCreateChapterInput(input);
    await this.assertUnitExists(unitId);

    try {
      const chapter = await this.prismaService.chapter.create({
        data: {
          unitId,
          title: validatedInput.title,
          sortOrder: validatedInput.sortOrder,
        },
        include: {
          lessons: {
            orderBy: LESSON_ORDER,
          },
        },
      });

      return {
        ...toAdminChapterSummaryResponse(chapter),
        unitId: chapter.unitId,
        lessons: chapter.lessons.map(toAdminLessonSummaryResponse),
      };
    } catch (error) {
      this.logger.error(`Failed to create chapter in unit ${unitId}`, error);
      throw error;
    }
  }

  async updateChapter(
    chapterId: string,
    input: unknown,
  ): Promise<AdminChapterDetailResponse> {
    const validatedInput = this.parseUpdateChapterInput(input);
    await this.assertChapterExists(chapterId);

    try {
      const chapter = await this.prismaService.chapter.update({
        where: { id: chapterId },
        data: validatedInput,
        include: {
          lessons: {
            orderBy: LESSON_ORDER,
          },
        },
      });

      return {
        ...toAdminChapterSummaryResponse(chapter),
        unitId: chapter.unitId,
        lessons: chapter.lessons.map(toAdminLessonSummaryResponse),
      };
    } catch (error) {
      this.logger.error(`Failed to update chapter ${chapterId}`, error);
      throw error;
    }
  }

  async publishChapter(chapterId: string): Promise<AdminChapterDetailResponse> {
    await this.assertChapterExists(chapterId);

    try {
      const chapter = await this.prismaService.chapter.update({
        where: { id: chapterId },
        data: {
          isPublished: true,
          publishedAt: new Date(),
        },
        include: {
          lessons: {
            orderBy: LESSON_ORDER,
          },
        },
      });

      return {
        ...toAdminChapterSummaryResponse(chapter),
        unitId: chapter.unitId,
        lessons: chapter.lessons.map(toAdminLessonSummaryResponse),
      };
    } catch (error) {
      this.logger.error(`Failed to publish chapter ${chapterId}`, error);
      throw error;
    }
  }

  async unpublishChapter(
    chapterId: string,
  ): Promise<AdminChapterDetailResponse> {
    await this.assertChapterExists(chapterId);

    try {
      const chapter = await this.prismaService.chapter.update({
        where: { id: chapterId },
        data: { isPublished: false },
        include: {
          lessons: {
            orderBy: LESSON_ORDER,
          },
        },
      });

      return {
        ...toAdminChapterSummaryResponse(chapter),
        unitId: chapter.unitId,
        lessons: chapter.lessons.map(toAdminLessonSummaryResponse),
      };
    } catch (error) {
      this.logger.error(`Failed to unpublish chapter ${chapterId}`, error);
      throw error;
    }
  }

  async createLesson(
    chapterId: string,
    input: unknown,
  ): Promise<AdminLessonDetailResponse> {
    const validatedInput = this.parseCreateLessonInput(input);
    await this.assertChapterExists(chapterId);

    try {
      const lesson = await this.prismaService.lesson.create({
        data: {
          chapterId,
          title: validatedInput.title,
          accessLevel: validatedInput.accessLevel,
          sortOrder: validatedInput.sortOrder,
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

      return toAdminLessonDetailResponse(lesson);
    } catch (error) {
      this.logger.error(
        `Failed to create lesson in chapter ${chapterId}`,
        error,
      );
      throw error;
    }
  }

  async updateLesson(
    lessonId: string,
    input: unknown,
  ): Promise<AdminLessonDetailResponse> {
    const validatedInput = this.parseUpdateLessonInput(input);
    await this.assertLessonExists(lessonId);

    try {
      const lesson = await this.prismaService.lesson.update({
        where: { id: lessonId },
        data: validatedInput,
        include: {
          videos: {
            orderBy: MEDIA_ORDER,
          },
          pdfs: {
            orderBy: MEDIA_ORDER,
          },
        },
      });

      return toAdminLessonDetailResponse(lesson);
    } catch (error) {
      this.logger.error(`Failed to update lesson ${lessonId}`, error);
      throw error;
    }
  }

  async publishLesson(
    lessonId: string,
    adminClerkId: string,
  ): Promise<AdminLessonDetailResponse> {
    await this.assertLessonExists(lessonId);

    try {
      const lesson = await this.prismaService.lesson.update({
        where: { id: lessonId },
        data: {
          isPublished: true,
          publishedAt: new Date(),
        },
        include: {
          chapter: {
            select: {
              id: true,
              unitId: true,
              unit: {
                select: {
                  region: true,
                },
              },
            },
          },
          videos: {
            orderBy: MEDIA_ORDER,
          },
          pdfs: {
            orderBy: MEDIA_ORDER,
          },
        },
      });

      this.analyticsService.captureLessonPublished(adminClerkId, {
        lessonId: lesson.id,
        chapterId: lesson.chapterId,
        unitId: lesson.chapter.unitId,
      });

      await this.notificationsService.notifyRegion({
        region: lesson.chapter.unit.region,
        type: 'lesson_published',
        entityId: lesson.id,
        title: 'درس جديد',
        body: lesson.title,
      });

      return toAdminLessonDetailResponse(lesson);
    } catch (error) {
      this.logger.error(`Failed to publish lesson ${lessonId}`, error);
      throw error;
    }
  }

  async unpublishLesson(lessonId: string): Promise<AdminLessonDetailResponse> {
    await this.assertLessonExists(lessonId);

    try {
      const lesson = await this.prismaService.lesson.update({
        where: { id: lessonId },
        data: { isPublished: false },
        include: {
          videos: {
            orderBy: MEDIA_ORDER,
          },
          pdfs: {
            orderBy: MEDIA_ORDER,
          },
        },
      });

      return toAdminLessonDetailResponse(lesson);
    } catch (error) {
      this.logger.error(`Failed to unpublish lesson ${lessonId}`, error);
      throw error;
    }
  }

  async createVideoUploadUrl(
    lessonId: string,
    input: unknown,
  ): Promise<MediaUploadUrlResponse> {
    const validatedInput = this.parseVideoUploadUrlInput(input);
    await this.assertLessonExists(lessonId);

    const storageKey = this.buildVideoStorageKey(
      lessonId,
      validatedInput.contentType,
    );

    try {
      const uploadUrl = await this.r2StorageService.createSignedPutUrl({
        key: storageKey,
        contentType: validatedInput.contentType,
        expiresInSeconds: CONTENT_UPLOAD_EXPIRES_SECONDS,
      });

      return {
        uploadUrl,
        storageKey,
        expiresInSeconds: CONTENT_UPLOAD_EXPIRES_SECONDS,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create video upload URL for lesson ${lessonId}`,
        error,
      );
      throw error;
    }
  }

  async attachVideo(
    lessonId: string,
    input: unknown,
  ): Promise<AdminVideoResponse> {
    const validatedInput = this.parseAttachVideoInput(input);
    await this.assertLessonExists(lessonId);
    this.assertVideoStorageKey(lessonId, validatedInput.storageKey);
    await this.assertValidVideoObject(validatedInput.storageKey);

    try {
      const video = await this.prismaService.lessonVideo.create({
        data: {
          lessonId,
          storageKey: validatedInput.storageKey,
          title: validatedInput.title,
          sortOrder: validatedInput.sortOrder,
          durationSeconds: validatedInput.durationSeconds,
        },
      });

      return toAdminVideoResponse(video);
    } catch (error) {
      this.logger.error(`Failed to attach video to lesson ${lessonId}`, error);
      throw error;
    }
  }

  async updateVideo(
    videoId: string,
    input: unknown,
  ): Promise<AdminVideoResponse> {
    const validatedInput = this.parseUpdateVideoInput(input);
    await this.assertVideoExists(videoId);

    try {
      const video = await this.prismaService.lessonVideo.update({
        where: { id: videoId },
        data: validatedInput,
      });

      return toAdminVideoResponse(video);
    } catch (error) {
      this.logger.error(`Failed to update video ${videoId}`, error);
      throw error;
    }
  }

  async createPdfUploadUrl(
    lessonId: string,
    input: unknown,
  ): Promise<MediaUploadUrlResponse> {
    const validatedInput = this.parsePdfUploadUrlInput(input);
    await this.assertLessonExists(lessonId);

    const storageKey = this.buildPdfStorageKey(
      lessonId,
      validatedInput.contentType,
    );

    try {
      const uploadUrl = await this.r2StorageService.createSignedPutUrl({
        key: storageKey,
        contentType: validatedInput.contentType,
        expiresInSeconds: CONTENT_UPLOAD_EXPIRES_SECONDS,
      });

      return {
        uploadUrl,
        storageKey,
        expiresInSeconds: CONTENT_UPLOAD_EXPIRES_SECONDS,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create PDF upload URL for lesson ${lessonId}`,
        error,
      );
      throw error;
    }
  }

  async attachPdf(lessonId: string, input: unknown): Promise<AdminPdfResponse> {
    const validatedInput = this.parseAttachPdfInput(input);
    await this.assertLessonExists(lessonId);
    this.assertPdfStorageKey(lessonId, validatedInput.storageKey);
    await this.assertValidPdfObject(validatedInput.storageKey);

    try {
      const pdf = await this.prismaService.lessonPdf.create({
        data: {
          lessonId,
          storageKey: validatedInput.storageKey,
          title: validatedInput.title,
          sortOrder: validatedInput.sortOrder,
        },
      });

      return toAdminPdfResponse(pdf);
    } catch (error) {
      this.logger.error(`Failed to attach PDF to lesson ${lessonId}`, error);
      throw error;
    }
  }

  async updatePdf(pdfId: string, input: unknown): Promise<AdminPdfResponse> {
    const validatedInput = this.parseUpdatePdfInput(input);
    await this.assertPdfExists(pdfId);

    try {
      const pdf = await this.prismaService.lessonPdf.update({
        where: { id: pdfId },
        data: validatedInput,
      });

      return toAdminPdfResponse(pdf);
    } catch (error) {
      this.logger.error(`Failed to update PDF ${pdfId}`, error);
      throw error;
    }
  }

  async deleteVideo(
    videoId: string,
  ): Promise<{ deleted: true; id: string }> {
    const video = await this.getVideoOrThrow(videoId);

    try {
      await this.r2StorageService.deleteObject(video.storageKey);
    } catch (error) {
      this.logger.error(
        `Failed to delete video object ${video.storageKey} for video ${videoId}; continuing with DB delete`,
        error,
      );
    }

    try {
      await this.prismaService.lessonVideo.delete({
        where: { id: videoId },
      });

      return { deleted: true, id: videoId };
    } catch (error) {
      this.logger.error(`Failed to delete video ${videoId}`, error);
      throw error;
    }
  }

  async deletePdf(pdfId: string): Promise<{ deleted: true; id: string }> {
    const pdf = await this.getPdfOrThrow(pdfId);

    try {
      await this.r2StorageService.deleteObject(pdf.storageKey);
    } catch (error) {
      this.logger.error(
        `Failed to delete PDF object ${pdf.storageKey} for PDF ${pdfId}; continuing with DB delete`,
        error,
      );
    }

    try {
      await this.prismaService.lessonPdf.delete({
        where: { id: pdfId },
      });

      return { deleted: true, id: pdfId };
    } catch (error) {
      this.logger.error(`Failed to delete PDF ${pdfId}`, error);
      throw error;
    }
  }

  private parseCreateUnitInput(input: unknown): CreateUnitInput {
    try {
      return createUnitSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate create unit payload', error);
      throw error;
    }
  }

  private parseUpdateUnitInput(input: unknown): UpdateUnitInput {
    try {
      return updateUnitSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate update unit payload', error);
      throw error;
    }
  }

  private parseCreateChapterInput(input: unknown): CreateChapterInput {
    try {
      return createChapterSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate create chapter payload', error);
      throw error;
    }
  }

  private parseUpdateChapterInput(input: unknown): UpdateChapterInput {
    try {
      return updateChapterSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate update chapter payload', error);
      throw error;
    }
  }

  private parseCreateLessonInput(input: unknown): CreateLessonInput {
    try {
      return createLessonSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate create lesson payload', error);
      throw error;
    }
  }

  private parseUpdateLessonInput(input: unknown): UpdateLessonInput {
    try {
      return updateLessonSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate update lesson payload', error);
      throw error;
    }
  }

  private parseVideoUploadUrlInput(input: unknown): CreateVideoUploadUrlInput {
    try {
      return createVideoUploadUrlSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate video upload URL payload', error);
      throw error;
    }
  }

  private parsePdfUploadUrlInput(input: unknown): CreatePdfUploadUrlInput {
    try {
      return createPdfUploadUrlSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate PDF upload URL payload', error);
      throw error;
    }
  }

  private parseAttachVideoInput(input: unknown): AttachVideoInput {
    try {
      return attachVideoSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate attach video payload', error);
      throw error;
    }
  }

  private parseAttachPdfInput(input: unknown): AttachPdfInput {
    try {
      return attachPdfSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate attach PDF payload', error);
      throw error;
    }
  }

  private parseUpdateVideoInput(input: unknown): UpdateVideoInput {
    try {
      return updateVideoSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate update video payload', error);
      throw error;
    }
  }

  private parseUpdatePdfInput(input: unknown): UpdatePdfInput {
    try {
      return updatePdfSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate update PDF payload', error);
      throw error;
    }
  }

  private buildVideoStorageKey(
    lessonId: string,
    contentType: AllowedVideoContentType,
  ): string {
    const extension = VIDEO_CONTENT_TYPE_EXTENSION[contentType];
    return `${VIDEO_KEY_PREFIX}/${lessonId}/${randomUUID()}.${extension}`;
  }

  private buildPdfStorageKey(
    lessonId: string,
    contentType: AllowedPdfContentType,
  ): string {
    const extension = PDF_CONTENT_TYPE_EXTENSION[contentType];
    return `${PDF_KEY_PREFIX}/${lessonId}/${randomUUID()}.${extension}`;
  }

  private assertVideoStorageKey(lessonId: string, storageKey: string): void {
    const keyPattern = buildVideoStorageKeyPattern(lessonId);

    if (!keyPattern.test(storageKey)) {
      throw new BadRequestException('Invalid video storage key');
    }
  }

  private assertPdfStorageKey(lessonId: string, storageKey: string): void {
    const keyPattern = buildPdfStorageKeyPattern(lessonId);

    if (!keyPattern.test(storageKey)) {
      throw new BadRequestException('Invalid PDF storage key');
    }
  }

  private async assertValidVideoObject(storageKey: string): Promise<void> {
    try {
      const metadata = await this.r2StorageService.headObject(storageKey);
      const validation = validateVideoObjectMetadata(metadata);

      if (!validation.valid) {
        throw new BadRequestException(
          lessonMediaValidationErrorMessage(validation.error, 'video'),
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to validate video object for key ${storageKey}`,
        error,
      );
      throw error;
    }
  }

  private async assertValidPdfObject(storageKey: string): Promise<void> {
    try {
      const metadata = await this.r2StorageService.headObject(storageKey);
      const validation = validatePdfObjectMetadata(metadata);

      if (!validation.valid) {
        throw new BadRequestException(
          lessonMediaValidationErrorMessage(validation.error, 'pdf'),
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to validate PDF object for key ${storageKey}`,
        error,
      );
      throw error;
    }
  }

  private async assertUnitExists(unitId: string): Promise<void> {
    try {
      const unit = await this.prismaService.unit.findUnique({
        where: { id: unitId },
        select: { id: true },
      });

      if (!unit) {
        throw new NotFoundException('Unit not found');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to verify unit ${unitId}`, error);
      throw error;
    }
  }

  private async assertChapterExists(chapterId: string): Promise<void> {
    try {
      const chapter = await this.prismaService.chapter.findUnique({
        where: { id: chapterId },
        select: { id: true },
      });

      if (!chapter) {
        throw new NotFoundException('Chapter not found');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to verify chapter ${chapterId}`, error);
      throw error;
    }
  }

  private async assertLessonExists(lessonId: string): Promise<void> {
    try {
      const lesson = await this.prismaService.lesson.findUnique({
        where: { id: lessonId },
        select: { id: true },
      });

      if (!lesson) {
        throw new NotFoundException('Lesson not found');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to verify lesson ${lessonId}`, error);
      throw error;
    }
  }

  private async assertVideoExists(videoId: string): Promise<void> {
    await this.getVideoOrThrow(videoId);
  }

  private async assertPdfExists(pdfId: string): Promise<void> {
    await this.getPdfOrThrow(pdfId);
  }

  private async getVideoOrThrow(videoId: string): Promise<{
    id: string;
    storageKey: string;
  }> {
    try {
      const video = await this.prismaService.lessonVideo.findUnique({
        where: { id: videoId },
        select: { id: true, storageKey: true },
      });

      if (!video) {
        throw new NotFoundException('Video not found');
      }

      return video;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to verify video ${videoId}`, error);
      throw error;
    }
  }

  private async getPdfOrThrow(pdfId: string): Promise<{
    id: string;
    storageKey: string;
  }> {
    try {
      const pdf = await this.prismaService.lessonPdf.findUnique({
        where: { id: pdfId },
        select: { id: true, storageKey: true },
      });

      if (!pdf) {
        throw new NotFoundException('PDF not found');
      }

      return pdf;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to verify PDF ${pdfId}`, error);
      throw error;
    }
  }
}
