import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.schema';
import { PrismaService } from '../../lib/database/prisma.service';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import type { PublicHomeGalleryListResponse } from './types/public-home-gallery.response';

@Injectable()
export class PublicHomeGalleryService {
  private readonly logger = new Logger(PublicHomeGalleryService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async listPublished(): Promise<PublicHomeGalleryListResponse> {
    try {
      const rows = await this.prismaService.homeGallerySlide.findMany({
        where: { isPublished: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });

      const expiresInSeconds = this.configService.get('SIGNED_URL_TTL_SECONDS', {
        infer: true,
      });

      const slides = (
        await Promise.all(
          rows.map(async (row) => {
            const imageUrl = await this.resolveImageUrl(
              row.id,
              row.imageStorageKey,
              row.externalImageUrl,
              expiresInSeconds,
            );
            if (!imageUrl) return null;

            return {
              id: row.id,
              caption: row.caption,
              sortOrder: row.sortOrder,
              imageUrl,
            };
          }),
        )
      ).filter((item): item is NonNullable<typeof item> => item !== null);

      return { slides };
    } catch (error) {
      this.logger.error('Failed to list public home gallery slides', error);
      throw error;
    }
  }

  private async resolveImageUrl(
    slideId: string,
    imageStorageKey: string | null,
    externalImageUrl: string | null,
    expiresInSeconds: number,
  ): Promise<string | null> {
    if (imageStorageKey) {
      try {
        const exists = await this.r2StorageService.objectExists(imageStorageKey);
        if (!exists) {
          this.logger.warn(
            `Skipping home gallery slide ${slideId}: storage object missing`,
          );
          return externalImageUrl;
        }

        return await this.r2StorageService.createSignedGetUrl({
          key: imageStorageKey,
          expiresInSeconds,
        });
      } catch (error) {
        this.logger.warn(
          `Skipping signed URL for home gallery slide ${slideId}`,
          error instanceof Error ? error.message : error,
        );
        return externalImageUrl;
      }
    }

    return externalImageUrl;
  }
}
