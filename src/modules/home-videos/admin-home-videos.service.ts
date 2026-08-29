import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import { PrismaService } from '../../lib/database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import {
  HOME_VIDEO_CONTENT_TYPE_EXTENSION,
  HOME_VIDEO_KEY_PREFIX,
  HOME_VIDEO_PLAYBACK_URL_EXPIRES_SECONDS,
  HOME_VIDEO_UPLOAD_EXPIRES_SECONDS,
  buildHomeVideoStorageKeyPattern,
  type AllowedHomeVideoContentType,
} from './constants/home-video-upload.constants';
import {
  attachHomeVideoSchema,
  createHomeVideoSchema,
  createHomeVideoUploadUrlSchema,
  updateHomeVideoSchema,
  type AttachHomeVideoInput,
  type CreateHomeVideoInput,
  type CreateHomeVideoUploadUrlInput,
  type UpdateHomeVideoInput,
} from './schemas/home-video.schemas';
import {
  toAdminHomeVideoSummaryResponse,
  type AdminHomeVideoListResponse,
  type AdminHomeVideoSummaryResponse,
  type HomeVideoPlaybackUrlResponse,
  type HomeVideoUploadUrlResponse,
} from './types/admin-home-video.response';
import {
  homeVideoValidationErrorMessage,
  validateHomeVideoObjectMetadata,
} from './utils/home-video-object.validation';
import {
  titleLinesToPlainText,
  type HomeVideoTitleLine,
} from './utils/home-video-title-lines';

@Injectable()
export class AdminHomeVideosService {
  private readonly logger = new Logger(AdminHomeVideosService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
  ) {}

  async listAll(): Promise<AdminHomeVideoListResponse> {
    try {
      const homeVideos = await this.prismaService.homeVideo.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });

      return {
        homeVideos: homeVideos.map(toAdminHomeVideoSummaryResponse),
      };
    } catch (error) {
      this.logger.error('Failed to list home videos', error);
      throw error;
    }
  }

  async getById(homeVideoId: string): Promise<AdminHomeVideoSummaryResponse> {
    const homeVideo = await this.requireHomeVideo(homeVideoId);
    return toAdminHomeVideoSummaryResponse(homeVideo);
  }

  async create(input: unknown): Promise<AdminHomeVideoSummaryResponse> {
    const validatedInput = this.parseCreateInput(input);
    const title = this.deriveTitle(
      validatedInput.title,
      validatedInput.titleLines,
    );

    if (!title) {
      throw new BadRequestException('Either title or titleLines is required');
    }

    try {
      const homeVideo = await this.prismaService.homeVideo.create({
        data: {
          title,
          titleLines: validatedInput.titleLines ?? undefined,
          sortOrder: validatedInput.sortOrder,
        },
      });

      return toAdminHomeVideoSummaryResponse(homeVideo);
    } catch (error) {
      this.logger.error('Failed to create home video', error);
      throw error;
    }
  }

  async update(
    homeVideoId: string,
    input: unknown,
  ): Promise<AdminHomeVideoSummaryResponse> {
    const validatedInput = this.parseUpdateInput(input);
    await this.requireHomeVideo(homeVideoId);

    const title = this.deriveTitle(
      validatedInput.title,
      validatedInput.titleLines,
    );

    try {
      const homeVideo = await this.prismaService.homeVideo.update({
        where: { id: homeVideoId },
        data: {
          title,
          titleLines: this.resolveTitleLinesUpdate(validatedInput),
          sortOrder: validatedInput.sortOrder,
        },
      });

      return toAdminHomeVideoSummaryResponse(homeVideo);
    } catch (error) {
      this.logger.error(`Failed to update home video ${homeVideoId}`, error);
      throw error;
    }
  }

  async publish(homeVideoId: string): Promise<AdminHomeVideoSummaryResponse> {
    const existing = await this.requireHomeVideo(homeVideoId);

    if (!existing.storageKey) {
      throw new BadRequestException(
        'Upload a video file before publishing',
      );
    }

    try {
      const homeVideo = await this.prismaService.homeVideo.update({
        where: { id: homeVideoId },
        data: {
          isPublished: true,
          publishedAt: new Date(),
        },
      });

      return toAdminHomeVideoSummaryResponse(homeVideo);
    } catch (error) {
      this.logger.error(`Failed to publish home video ${homeVideoId}`, error);
      throw error;
    }
  }

  async unpublish(homeVideoId: string): Promise<AdminHomeVideoSummaryResponse> {
    await this.requireHomeVideo(homeVideoId);

    try {
      const homeVideo = await this.prismaService.homeVideo.update({
        where: { id: homeVideoId },
        data: { isPublished: false },
      });

      return toAdminHomeVideoSummaryResponse(homeVideo);
    } catch (error) {
      this.logger.error(`Failed to unpublish home video ${homeVideoId}`, error);
      throw error;
    }
  }

  async delete(
    homeVideoId: string,
  ): Promise<{ deleted: true; id: string }> {
    await this.requireHomeVideo(homeVideoId);

    try {
      await this.prismaService.homeVideo.delete({
        where: { id: homeVideoId },
      });

      return { deleted: true, id: homeVideoId };
    } catch (error) {
      this.logger.error(`Failed to delete home video ${homeVideoId}`, error);
      throw error;
    }
  }

  async createUploadUrl(
    homeVideoId: string,
    input: unknown,
  ): Promise<HomeVideoUploadUrlResponse> {
    const validatedInput = this.parseUploadUrlInput(input);
    await this.requireHomeVideo(homeVideoId);

    const storageKey = this.buildStorageKey(
      homeVideoId,
      validatedInput.contentType,
    );

    try {
      const uploadUrl = await this.r2StorageService.createSignedPutUrl({
        key: storageKey,
        contentType: validatedInput.contentType,
        expiresInSeconds: HOME_VIDEO_UPLOAD_EXPIRES_SECONDS,
      });

      return {
        uploadUrl,
        storageKey,
        expiresInSeconds: HOME_VIDEO_UPLOAD_EXPIRES_SECONDS,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create upload URL for home video ${homeVideoId}`,
        error,
      );
      throw error;
    }
  }

  async attachVideo(
    homeVideoId: string,
    input: unknown,
  ): Promise<AdminHomeVideoSummaryResponse> {
    const validatedInput = this.parseAttachInput(input);
    await this.requireHomeVideo(homeVideoId);
    this.assertStorageKey(homeVideoId, validatedInput.storageKey);
    await this.assertValidVideoObject(validatedInput.storageKey);

    try {
      const homeVideo = await this.prismaService.homeVideo.update({
        where: { id: homeVideoId },
        data: { storageKey: validatedInput.storageKey },
      });

      return toAdminHomeVideoSummaryResponse(homeVideo);
    } catch (error) {
      this.logger.error(
        `Failed to attach video to home video ${homeVideoId}`,
        error,
      );
      throw error;
    }
  }

  async getPlaybackUrl(
    homeVideoId: string,
  ): Promise<HomeVideoPlaybackUrlResponse> {
    const homeVideo = await this.requireHomeVideo(homeVideoId);

    if (!homeVideo.storageKey) {
      throw new NotFoundException('Home video has no uploaded file');
    }

    try {
      const exists = await this.r2StorageService.objectExists(
        homeVideo.storageKey,
      );
      if (!exists) {
        throw new NotFoundException('Video file not found in storage');
      }

      const url = await this.r2StorageService.createSignedGetUrl({
        key: homeVideo.storageKey,
        expiresInSeconds: HOME_VIDEO_PLAYBACK_URL_EXPIRES_SECONDS,
      });

      return {
        url,
        expiresInSeconds: HOME_VIDEO_PLAYBACK_URL_EXPIRES_SECONDS,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to generate playback URL for home video ${homeVideoId}`,
        error,
      );
      throw error;
    }
  }

  /** `titleLines` wins so the plain `title` column stays in sync with them. */
  private deriveTitle(
    title: string | undefined,
    titleLines: HomeVideoTitleLine[] | undefined,
  ): string | undefined {
    return titleLines ? titleLinesToPlainText(titleLines) : title;
  }

  /**
   * A `title`-only update means "plain title", so any styled lines are dropped
   * rather than left behind describing the previous title.
   */
  private resolveTitleLinesUpdate(
    input: UpdateHomeVideoInput,
  ): HomeVideoTitleLine[] | typeof Prisma.DbNull | undefined {
    if (input.titleLines) return input.titleLines;
    return input.title ? Prisma.DbNull : undefined;
  }

  private parseCreateInput(input: unknown): CreateHomeVideoInput {
    return createHomeVideoSchema.parse(input);
  }

  private parseUpdateInput(input: unknown): UpdateHomeVideoInput {
    return updateHomeVideoSchema.parse(input);
  }

  private parseUploadUrlInput(input: unknown): CreateHomeVideoUploadUrlInput {
    return createHomeVideoUploadUrlSchema.parse(input);
  }

  private parseAttachInput(input: unknown): AttachHomeVideoInput {
    return attachHomeVideoSchema.parse(input);
  }

  private buildStorageKey(
    homeVideoId: string,
    contentType: AllowedHomeVideoContentType,
  ): string {
    const extension = HOME_VIDEO_CONTENT_TYPE_EXTENSION[contentType];
    return `${HOME_VIDEO_KEY_PREFIX}/${homeVideoId}/${randomUUID()}.${extension}`;
  }

  private assertStorageKey(homeVideoId: string, storageKey: string): void {
    const pattern = buildHomeVideoStorageKeyPattern(homeVideoId);

    if (!pattern.test(storageKey)) {
      throw new BadRequestException('Storage key does not match home video');
    }
  }

  private async assertValidVideoObject(storageKey: string): Promise<void> {
    try {
      const metadata = await this.r2StorageService.headObject(storageKey);
      const validation = validateHomeVideoObjectMetadata(metadata);

      if (!validation.valid) {
        throw new BadRequestException(
          homeVideoValidationErrorMessage(validation.error),
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to validate home video object for key ${storageKey}`,
        error,
      );
      throw error;
    }
  }

  private async requireHomeVideo(homeVideoId: string) {
    try {
      const homeVideo = await this.prismaService.homeVideo.findUnique({
        where: { id: homeVideoId },
      });

      if (!homeVideo) {
        throw new NotFoundException('Home video not found');
      }

      return homeVideo;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to load home video ${homeVideoId}`, error);
      throw error;
    }
  }
}
