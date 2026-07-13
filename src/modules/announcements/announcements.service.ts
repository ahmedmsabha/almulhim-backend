import { Injectable, Logger } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import { PrismaService } from '../../lib/database/prisma.service';
import { ANNOUNCEMENT_IMAGE_VIEW_URL_EXPIRES_SECONDS } from './constants/announcement-upload.constants';
import {
  toAnnouncementSummaryResponse,
  type AnnouncementListResponse,
} from './types/announcement.response';
import { buildAnnouncementVisibilityWhere } from './utils/announcement-access.utils';

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
  ) {}

  async listForUser(user: User): Promise<AnnouncementListResponse> {
    try {
      const announcements = await this.prismaService.announcement.findMany({
        where: buildAnnouncementVisibilityWhere(user.region),
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      });

      const items = await Promise.all(
        announcements.map(async (announcement) => {
          const imageUrl = await this.createImageUrl(
            announcement.imageStorageKey,
          );

          return toAnnouncementSummaryResponse(announcement, imageUrl);
        }),
      );

      return { announcements: items };
    } catch (error) {
      this.logger.error(
        `Failed to list announcements for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  private async createImageUrl(
    imageStorageKey: string | null,
  ): Promise<string | null> {
    if (!imageStorageKey) {
      return null;
    }

    try {
      return await this.r2StorageService.createSignedGetUrl({
        key: imageStorageKey,
        expiresInSeconds: ANNOUNCEMENT_IMAGE_VIEW_URL_EXPIRES_SECONDS,
      });
    } catch (error) {
      this.logger.error(
        `Failed to create signed image URL for key ${imageStorageKey}`,
        error,
      );
      return null;
    }
  }
}
