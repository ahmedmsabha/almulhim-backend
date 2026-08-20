import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import { PrismaService } from '../../lib/database/prisma.service';
import {
  HOME_GALLERY_IMAGE_CONTENT_TYPE_EXTENSION,
  HOME_GALLERY_IMAGE_VIEW_URL_EXPIRES_SECONDS,
  HOME_GALLERY_KEY_PREFIX,
  HOME_GALLERY_UPLOAD_EXPIRES_SECONDS,
  buildHomeGalleryImageStorageKeyPattern,
  type AllowedHomeGalleryImageContentType,
} from './constants/home-gallery-upload.constants';
import {
  attachHomeGalleryImageSchema,
  createHomeGalleryImageUploadUrlSchema,
  createHomeGallerySlideSchema,
  updateHomeGallerySlideSchema,
  type AttachHomeGalleryImageInput,
  type CreateHomeGalleryImageUploadUrlInput,
  type CreateHomeGallerySlideInput,
  type UpdateHomeGallerySlideInput,
} from './schemas/home-gallery.schemas';
import {
  toAdminHomeGallerySlideSummaryResponse,
  type AdminHomeGallerySlideListResponse,
  type AdminHomeGallerySlideSummaryResponse,
  type HomeGalleryImageUrlResponse,
  type HomeGalleryImageUploadUrlResponse,
} from './types/admin-home-gallery.response';
import {
  homeGalleryImageValidationErrorMessage,
  validateHomeGalleryImageMetadata,
} from './utils/home-gallery-object.validation';

@Injectable()
export class AdminHomeGalleryService {
  private readonly logger = new Logger(AdminHomeGalleryService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
  ) {}

  async listAll(): Promise<AdminHomeGallerySlideListResponse> {
    try {
      const slides = await this.prismaService.homeGallerySlide.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });

      return {
        slides: slides.map(toAdminHomeGallerySlideSummaryResponse),
      };
    } catch (error) {
      this.logger.error('Failed to list home gallery slides', error);
      throw error;
    }
  }

  async getById(slideId: string): Promise<AdminHomeGallerySlideSummaryResponse> {
    const slide = await this.requireSlide(slideId);
    return toAdminHomeGallerySlideSummaryResponse(slide);
  }

  async create(input: unknown): Promise<AdminHomeGallerySlideSummaryResponse> {
    const validatedInput = this.parseCreateInput(input);

    try {
      const slide = await this.prismaService.homeGallerySlide.create({
        data: {
          caption: validatedInput.caption,
          sortOrder: validatedInput.sortOrder,
        },
      });

      return toAdminHomeGallerySlideSummaryResponse(slide);
    } catch (error) {
      this.logger.error('Failed to create home gallery slide', error);
      throw error;
    }
  }

  async update(
    slideId: string,
    input: unknown,
  ): Promise<AdminHomeGallerySlideSummaryResponse> {
    const validatedInput = this.parseUpdateInput(input);
    await this.requireSlide(slideId);

    try {
      const slide = await this.prismaService.homeGallerySlide.update({
        where: { id: slideId },
        data: validatedInput,
      });

      return toAdminHomeGallerySlideSummaryResponse(slide);
    } catch (error) {
      this.logger.error(`Failed to update home gallery slide ${slideId}`, error);
      throw error;
    }
  }

  async publish(slideId: string): Promise<AdminHomeGallerySlideSummaryResponse> {
    const existing = await this.requireSlide(slideId);

    if (!existing.imageStorageKey && !existing.externalImageUrl) {
      throw new BadRequestException(
        'Upload an image before publishing',
      );
    }

    try {
      const slide = await this.prismaService.homeGallerySlide.update({
        where: { id: slideId },
        data: {
          isPublished: true,
          publishedAt: new Date(),
        },
      });

      return toAdminHomeGallerySlideSummaryResponse(slide);
    } catch (error) {
      this.logger.error(`Failed to publish home gallery slide ${slideId}`, error);
      throw error;
    }
  }

  async unpublish(
    slideId: string,
  ): Promise<AdminHomeGallerySlideSummaryResponse> {
    await this.requireSlide(slideId);

    try {
      const slide = await this.prismaService.homeGallerySlide.update({
        where: { id: slideId },
        data: { isPublished: false },
      });

      return toAdminHomeGallerySlideSummaryResponse(slide);
    } catch (error) {
      this.logger.error(
        `Failed to unpublish home gallery slide ${slideId}`,
        error,
      );
      throw error;
    }
  }

  async delete(slideId: string): Promise<{ deleted: true; id: string }> {
    await this.requireSlide(slideId);

    try {
      await this.prismaService.homeGallerySlide.delete({
        where: { id: slideId },
      });

      return { deleted: true, id: slideId };
    } catch (error) {
      this.logger.error(`Failed to delete home gallery slide ${slideId}`, error);
      throw error;
    }
  }

  async createUploadUrl(
    slideId: string,
    input: unknown,
  ): Promise<HomeGalleryImageUploadUrlResponse> {
    const validatedInput = this.parseUploadUrlInput(input);
    await this.requireSlide(slideId);

    const storageKey = this.buildStorageKey(
      slideId,
      validatedInput.contentType,
    );

    try {
      const uploadUrl = await this.r2StorageService.createSignedPutUrl({
        key: storageKey,
        contentType: validatedInput.contentType,
        expiresInSeconds: HOME_GALLERY_UPLOAD_EXPIRES_SECONDS,
      });

      return {
        uploadUrl,
        storageKey,
        expiresInSeconds: HOME_GALLERY_UPLOAD_EXPIRES_SECONDS,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create upload URL for home gallery slide ${slideId}`,
        error,
      );
      throw error;
    }
  }

  async attachImage(
    slideId: string,
    input: unknown,
  ): Promise<AdminHomeGallerySlideSummaryResponse> {
    const validatedInput = this.parseAttachInput(input);
    await this.requireSlide(slideId);
    this.assertStorageKey(slideId, validatedInput.storageKey);
    await this.assertValidImageObject(validatedInput.storageKey);

    try {
      const slide = await this.prismaService.homeGallerySlide.update({
        where: { id: slideId },
        data: { imageStorageKey: validatedInput.storageKey },
      });

      return toAdminHomeGallerySlideSummaryResponse(slide);
    } catch (error) {
      this.logger.error(
        `Failed to attach image to home gallery slide ${slideId}`,
        error,
      );
      throw error;
    }
  }

  async getImageUrl(slideId: string): Promise<HomeGalleryImageUrlResponse> {
    const slide = await this.requireSlide(slideId);

    if (slide.imageStorageKey) {
      try {
        const exists = await this.r2StorageService.objectExists(
          slide.imageStorageKey,
        );
        if (!exists) {
          throw new NotFoundException('Gallery image not found in storage');
        }

        const url = await this.r2StorageService.createSignedGetUrl({
          key: slide.imageStorageKey,
          expiresInSeconds: HOME_GALLERY_IMAGE_VIEW_URL_EXPIRES_SECONDS,
        });

        return {
          url,
          expiresInSeconds: HOME_GALLERY_IMAGE_VIEW_URL_EXPIRES_SECONDS,
        };
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error;
        }

        this.logger.error(
          `Failed to generate image URL for home gallery slide ${slideId}`,
          error,
        );
        throw error;
      }
    }

    if (slide.externalImageUrl) {
      return {
        url: slide.externalImageUrl,
        expiresInSeconds: HOME_GALLERY_IMAGE_VIEW_URL_EXPIRES_SECONDS,
      };
    }

    throw new NotFoundException('Home gallery slide has no image');
  }

  private parseCreateInput(input: unknown): CreateHomeGallerySlideInput {
    return createHomeGallerySlideSchema.parse(input);
  }

  private parseUpdateInput(input: unknown): UpdateHomeGallerySlideInput {
    return updateHomeGallerySlideSchema.parse(input);
  }

  private parseUploadUrlInput(
    input: unknown,
  ): CreateHomeGalleryImageUploadUrlInput {
    return createHomeGalleryImageUploadUrlSchema.parse(input);
  }

  private parseAttachInput(input: unknown): AttachHomeGalleryImageInput {
    return attachHomeGalleryImageSchema.parse(input);
  }

  private buildStorageKey(
    slideId: string,
    contentType: AllowedHomeGalleryImageContentType,
  ): string {
    const extension = HOME_GALLERY_IMAGE_CONTENT_TYPE_EXTENSION[contentType];
    return `${HOME_GALLERY_KEY_PREFIX}/${slideId}/${randomUUID()}.${extension}`;
  }

  private assertStorageKey(slideId: string, storageKey: string): void {
    const pattern = buildHomeGalleryImageStorageKeyPattern(slideId);

    if (!pattern.test(storageKey)) {
      throw new BadRequestException('Storage key does not match gallery slide');
    }
  }

  private async assertValidImageObject(storageKey: string): Promise<void> {
    try {
      const metadata = await this.r2StorageService.headObject(storageKey);
      const validation = validateHomeGalleryImageMetadata(metadata);

      if (!validation.valid) {
        throw new BadRequestException(
          homeGalleryImageValidationErrorMessage(validation.error),
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to validate home gallery image object for key ${storageKey}`,
        error,
      );
      throw error;
    }
  }

  private async requireSlide(slideId: string) {
    try {
      const slide = await this.prismaService.homeGallerySlide.findUnique({
        where: { id: slideId },
      });

      if (!slide) {
        throw new NotFoundException('Home gallery slide not found');
      }

      return slide;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to load home gallery slide ${slideId}`, error);
      throw error;
    }
  }
}
