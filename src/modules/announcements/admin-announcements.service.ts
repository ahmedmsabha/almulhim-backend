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
  ANNOUNCEMENT_KEY_PREFIX,
  ANNOUNCEMENT_UPLOAD_EXPIRES_SECONDS,
  ANNOUNCEMENT_IMAGE_CONTENT_TYPE_EXTENSION,
  buildAnnouncementImageStorageKeyPattern,
  type AllowedAnnouncementImageContentType,
} from './constants/announcement-upload.constants';
import {
  attachImageSchema,
  createAnnouncementSchema,
  createImageUploadUrlSchema,
  updateAnnouncementSchema,
  type AttachImageInput,
  type CreateAnnouncementInput,
  type CreateImageUploadUrlInput,
  type UpdateAnnouncementInput,
} from './schemas/announcement.schemas';
import {
  toAdminAnnouncementSummaryResponse,
  type AdminAnnouncementListResponse,
  type AdminAnnouncementSummaryResponse,
  type ImageUploadUrlResponse,
} from './types/admin-announcement.response';
import {
  announcementImageValidationErrorMessage,
  validateAnnouncementImageMetadata,
} from './utils/announcement-object.validation';

@Injectable()
export class AdminAnnouncementsService {
  private readonly logger = new Logger(AdminAnnouncementsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
    private readonly analyticsService: AnalyticsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listAll(): Promise<AdminAnnouncementListResponse> {
    try {
      const announcements = await this.prismaService.announcement.findMany({
        orderBy: [{ createdAt: 'desc' }],
      });

      return {
        announcements: announcements.map(toAdminAnnouncementSummaryResponse),
      };
    } catch (error) {
      this.logger.error('Failed to list announcements', error);
      throw error;
    }
  }

  async getById(
    announcementId: string,
  ): Promise<AdminAnnouncementSummaryResponse> {
    const announcement = await this.requireAnnouncement(announcementId);
    return toAdminAnnouncementSummaryResponse(announcement);
  }

  async create(input: unknown): Promise<AdminAnnouncementSummaryResponse> {
    const validatedInput = this.parseCreateInput(input);

    try {
      const announcement = await this.prismaService.announcement.create({
        data: {
          title: validatedInput.title,
          body: validatedInput.body,
          region: validatedInput.region,
        },
      });

      return toAdminAnnouncementSummaryResponse(announcement);
    } catch (error) {
      this.logger.error('Failed to create announcement', error);
      throw error;
    }
  }

  async update(
    announcementId: string,
    input: unknown,
  ): Promise<AdminAnnouncementSummaryResponse> {
    const validatedInput = this.parseUpdateInput(input);
    await this.requireAnnouncement(announcementId);

    try {
      const announcement = await this.prismaService.announcement.update({
        where: { id: announcementId },
        data: validatedInput,
      });

      return toAdminAnnouncementSummaryResponse(announcement);
    } catch (error) {
      this.logger.error(
        `Failed to update announcement ${announcementId}`,
        error,
      );
      throw error;
    }
  }

  async publish(
    announcementId: string,
    adminClerkId: string,
  ): Promise<AdminAnnouncementSummaryResponse> {
    await this.requireAnnouncement(announcementId);

    try {
      const announcement = await this.prismaService.announcement.update({
        where: { id: announcementId },
        data: {
          isPublished: true,
          publishedAt: new Date(),
        },
      });

      this.analyticsService.captureAnnouncementPublished(adminClerkId, {
        announcementId: announcement.id,
        region: announcement.region,
      });

      await this.notificationsService.notifyRegion({
        region: announcement.region,
        type: 'announcement_published',
        entityId: announcement.id,
        title: announcement.title,
        body: announcement.body.slice(0, 100),
      });

      return toAdminAnnouncementSummaryResponse(announcement);
    } catch (error) {
      this.logger.error(
        `Failed to publish announcement ${announcementId}`,
        error,
      );
      throw error;
    }
  }

  async unpublish(
    announcementId: string,
  ): Promise<AdminAnnouncementSummaryResponse> {
    await this.requireAnnouncement(announcementId);

    try {
      const announcement = await this.prismaService.announcement.update({
        where: { id: announcementId },
        data: { isPublished: false },
      });

      return toAdminAnnouncementSummaryResponse(announcement);
    } catch (error) {
      this.logger.error(
        `Failed to unpublish announcement ${announcementId}`,
        error,
      );
      throw error;
    }
  }

  async createImageUploadUrl(
    announcementId: string,
    input: unknown,
  ): Promise<ImageUploadUrlResponse> {
    const validatedInput = this.parseImageUploadUrlInput(input);
    await this.requireAnnouncement(announcementId);

    const storageKey = this.buildImageStorageKey(
      announcementId,
      validatedInput.contentType,
    );

    try {
      const uploadUrl = await this.r2StorageService.createSignedPutUrl({
        key: storageKey,
        contentType: validatedInput.contentType,
        expiresInSeconds: ANNOUNCEMENT_UPLOAD_EXPIRES_SECONDS,
      });

      return {
        uploadUrl,
        storageKey,
        expiresInSeconds: ANNOUNCEMENT_UPLOAD_EXPIRES_SECONDS,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create image upload URL for announcement ${announcementId}`,
        error,
      );
      throw error;
    }
  }

  async attachImage(
    announcementId: string,
    input: unknown,
  ): Promise<AdminAnnouncementSummaryResponse> {
    const validatedInput = this.parseAttachImageInput(input);
    await this.requireAnnouncement(announcementId);
    this.assertImageStorageKey(announcementId, validatedInput.storageKey);
    await this.assertValidImageObject(validatedInput.storageKey);

    try {
      const announcement = await this.prismaService.announcement.update({
        where: { id: announcementId },
        data: { imageStorageKey: validatedInput.storageKey },
      });

      return toAdminAnnouncementSummaryResponse(announcement);
    } catch (error) {
      this.logger.error(
        `Failed to attach image to announcement ${announcementId}`,
        error,
      );
      throw error;
    }
  }

  private parseCreateInput(input: unknown): CreateAnnouncementInput {
    try {
      return createAnnouncementSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate create announcement payload', error);
      throw error;
    }
  }

  private parseUpdateInput(input: unknown): UpdateAnnouncementInput {
    try {
      return updateAnnouncementSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate update announcement payload', error);
      throw error;
    }
  }

  private parseImageUploadUrlInput(
    input: unknown,
  ): CreateImageUploadUrlInput {
    try {
      return createImageUploadUrlSchema.parse(input);
    } catch (error) {
      this.logger.error(
        'Failed to validate announcement image upload URL payload',
        error,
      );
      throw error;
    }
  }

  private parseAttachImageInput(input: unknown): AttachImageInput {
    try {
      return attachImageSchema.parse(input);
    } catch (error) {
      this.logger.error(
        'Failed to validate attach announcement image payload',
        error,
      );
      throw error;
    }
  }

  private buildImageStorageKey(
    announcementId: string,
    contentType: AllowedAnnouncementImageContentType,
  ): string {
    const extension = ANNOUNCEMENT_IMAGE_CONTENT_TYPE_EXTENSION[contentType];
    return `${ANNOUNCEMENT_KEY_PREFIX}/${announcementId}/${randomUUID()}.${extension}`;
  }

  private assertImageStorageKey(
    announcementId: string,
    storageKey: string,
  ): void {
    const pattern = buildAnnouncementImageStorageKeyPattern(announcementId);

    if (!pattern.test(storageKey)) {
      throw new BadRequestException('Storage key does not match announcement');
    }
  }

  private async assertValidImageObject(storageKey: string): Promise<void> {
    try {
      const metadata = await this.r2StorageService.headObject(storageKey);
      const validation = validateAnnouncementImageMetadata(metadata);

      if (!validation.valid) {
        throw new BadRequestException(
          announcementImageValidationErrorMessage(validation.error),
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to validate announcement image for key ${storageKey}`,
        error,
      );
      throw error;
    }
  }

  private async requireAnnouncement(announcementId: string) {
    try {
      const announcement = await this.prismaService.announcement.findUnique({
        where: { id: announcementId },
      });

      if (!announcement) {
        throw new NotFoundException('Announcement not found');
      }

      return announcement;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to load announcement ${announcementId}`,
        error,
      );
      throw error;
    }
  }
}
