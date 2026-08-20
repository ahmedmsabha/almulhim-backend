import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.schema';
import { PrismaService } from '../../lib/database/prisma.service';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import type { PublicHomeVideoListResponse } from './types/public-home-video.response';

@Injectable()
export class PublicHomeVideosService {
  private readonly logger = new Logger(PublicHomeVideosService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async listPublished(): Promise<PublicHomeVideoListResponse> {
    try {
      const rows = await this.prismaService.homeVideo.findMany({
        where: {
          isPublished: true,
          storageKey: { not: null },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });

      const expiresInSeconds = this.configService.get('SIGNED_URL_TTL_SECONDS', {
        infer: true,
      });

      const homeVideos = (
        await Promise.all(
          rows.map(async (row) => {
            const storageKey = row.storageKey;
            if (!storageKey) return null;

            try {
              const exists =
                await this.r2StorageService.objectExists(storageKey);
              if (!exists) return null;

              const playbackUrl =
                await this.r2StorageService.createSignedGetUrl({
                  key: storageKey,
                  expiresInSeconds,
                });

              return {
                id: row.id,
                title: row.title,
                sortOrder: row.sortOrder,
                playbackUrl,
                playbackExpiresInSeconds: expiresInSeconds,
              };
            } catch (error) {
              this.logger.warn(
                `Skipping home video ${row.id}: failed to sign playback URL`,
                error instanceof Error ? error.message : error,
              );
              return null;
            }
          }),
        )
      ).filter((item): item is NonNullable<typeof item> => item !== null);

      return { homeVideos };
    } catch (error) {
      this.logger.error('Failed to list public home videos', error);
      throw error;
    }
  }
}
