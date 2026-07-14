import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.schema';
import type {
  AuthenticatedRequest,
  DeviceRequestContext,
} from '../../common/types/authenticated-request.type';
import type {
  Lesson,
  User,
  VideoDownload,
} from '../../generated/prisma/client';
import { PrismaService } from '../../lib/database/prisma.service';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import {
  buildUnitVisibilityWhere,
  computeIsLocked,
} from '../content/utils/content-access.utils';
import {
  toPdfViewAuthorizeResponse,
  toVideoDownloadAuthorizeResponse,
  toVideoDownloadSyncItemResponse,
  type PdfViewAuthorizeResponse,
  type VideoDownloadAuthorizeResponse,
  type VideoDownloadListResponse,
} from './types/download.response';

type LessonVideoWithContext = {
  id: string;
  storageKey: string;
  lesson: Lesson;
};

type LessonPdfWithContext = {
  id: string;
  storageKey: string;
  lesson: Lesson;
};

const PUBLISHED_LESSON_WHERE = { isPublished: true } as const;

const PUBLISHED_CHAPTER_WHERE = { isPublished: true } as const;

@Injectable()
export class DownloadsService {
  private readonly logger = new Logger(DownloadsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async authorizeVideoDownloadFromRequest(
    request: AuthenticatedRequest,
    lessonVideoId: string,
  ): Promise<VideoDownloadAuthorizeResponse> {
    if (!request.user || !request.device) {
      throw new NotFoundException('Device context is missing');
    }

    return this.authorizeVideoDownload(
      request.user,
      request.device,
      lessonVideoId,
    );
  }

  async listMyDownloadsFromRequest(
    request: AuthenticatedRequest,
  ): Promise<VideoDownloadListResponse> {
    if (!request.user || !request.device) {
      throw new NotFoundException('Device context is missing');
    }

    return this.listMyDownloads(request.user, request.device);
  }

  async authorizePdfViewFromRequest(
    request: AuthenticatedRequest,
    lessonPdfId: string,
  ): Promise<PdfViewAuthorizeResponse> {
    if (!request.user || !request.device) {
      throw new NotFoundException('Device context is missing');
    }

    return this.authorizePdfView(request.user, request.device, lessonPdfId);
  }

  async authorizeVideoDownload(
    user: User,
    device: DeviceRequestContext,
    lessonVideoId: string,
  ): Promise<VideoDownloadAuthorizeResponse> {
    this.assertMobileDevice(device);

    const lessonVideo = await this.loadAccessibleLessonVideo(
      user,
      lessonVideoId,
    );
    const hasActiveSubscription = await this.hasActiveSubscription(user.id);

    if (
      computeIsLocked(lessonVideo.lesson.accessLevel, hasActiveSubscription)
    ) {
      throw new NotFoundException('Lesson video not found');
    }

    const objectMetadata = await this.r2StorageService.headObject(
      lessonVideo.storageKey,
    );

    if (!objectMetadata) {
      throw new NotFoundException('Lesson video not found');
    }

    try {
      const download = await this.upsertActiveDownload(
        user.id,
        lessonVideoId,
        device.deviceHash,
      );
      const expiresInSeconds = this.configService.get(
        'SIGNED_URL_TTL_SECONDS',
        {
          infer: true,
        },
      );
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
      const url = await this.r2StorageService.createSignedGetUrl({
        key: lessonVideo.storageKey,
        expiresInSeconds,
      });

      return toVideoDownloadAuthorizeResponse(download, url, expiresAt);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to authorize video download ${lessonVideoId} for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async authorizePdfView(
    user: User,
    device: DeviceRequestContext,
    lessonPdfId: string,
  ): Promise<PdfViewAuthorizeResponse> {
    this.assertMobileDevice(device);

    const lessonPdf = await this.loadAccessibleLessonPdf(user, lessonPdfId);
    const hasActiveSubscription = await this.hasActiveSubscription(user.id);

    if (
      computeIsLocked(lessonPdf.lesson.accessLevel, hasActiveSubscription)
    ) {
      throw new NotFoundException('Lesson PDF not found');
    }

    const objectMetadata = await this.r2StorageService.headObject(
      lessonPdf.storageKey,
    );

    if (!objectMetadata) {
      throw new NotFoundException('Lesson PDF not found');
    }

    try {
      const expiresInSeconds = this.configService.get(
        'SIGNED_URL_TTL_SECONDS',
        {
          infer: true,
        },
      );
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
      const url = await this.r2StorageService.createSignedGetUrl({
        key: lessonPdf.storageKey,
        expiresInSeconds,
      });

      return toPdfViewAuthorizeResponse(url, expiresAt);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to authorize PDF view ${lessonPdfId} for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async listMyDownloads(
    user: User,
    device: DeviceRequestContext,
  ): Promise<VideoDownloadListResponse> {
    this.assertMobileDevice(device);

    try {
      const hasActiveSubscription = await this.hasActiveSubscription(user.id);
      const downloads = await this.prismaService.videoDownload.findMany({
        where: {
          userId: user.id,
          deviceHash: device.deviceHash,
        },
        include: {
          lessonVideo: {
            include: {
              lesson: {
                include: {
                  chapter: {
                    include: {
                      unit: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ downloadedAt: 'desc' }, { createdAt: 'desc' }],
      });

      return {
        downloads: downloads.map((download) =>
          toVideoDownloadSyncItemResponse(
            download,
            this.isDownloadAccessValid(user, download, hasActiveSubscription),
          ),
        ),
      };
    } catch (error) {
      this.logger.error(`Failed to list downloads for user ${user.id}`, error);
      throw error;
    }
  }

  async revokeDownloads(
    userId: string,
    options: { deviceHash?: string } = {},
  ): Promise<void> {
    try {
      await this.prismaService.videoDownload.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(options.deviceHash ? { deviceHash: options.deviceHash } : {}),
        },
        data: {
          revokedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to revoke downloads for user ${userId}`, error);
      throw error;
    }
  }

  private assertMobileDevice(device: DeviceRequestContext): void {
    if (device.deviceType !== 'mobile') {
      throw new ForbiddenException(
        'Media access is available on mobile devices only',
      );
    }
  }

  private async loadAccessibleLessonVideo(
    user: User,
    lessonVideoId: string,
  ): Promise<LessonVideoWithContext> {
    try {
      const lessonVideo = await this.prismaService.lessonVideo.findFirst({
        where: {
          id: lessonVideoId,
          lesson: {
            ...PUBLISHED_LESSON_WHERE,
            chapter: {
              ...PUBLISHED_CHAPTER_WHERE,
              unit: buildUnitVisibilityWhere(user.region),
            },
          },
        },
        include: {
          lesson: true,
        },
      });

      if (!lessonVideo) {
        throw new NotFoundException('Lesson video not found');
      }

      return lessonVideo;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to load lesson video ${lessonVideoId} for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  private async loadAccessibleLessonPdf(
    user: User,
    lessonPdfId: string,
  ): Promise<LessonPdfWithContext> {
    try {
      const lessonPdf = await this.prismaService.lessonPdf.findFirst({
        where: {
          id: lessonPdfId,
          lesson: {
            ...PUBLISHED_LESSON_WHERE,
            chapter: {
              ...PUBLISHED_CHAPTER_WHERE,
              unit: buildUnitVisibilityWhere(user.region),
            },
          },
        },
        include: {
          lesson: true,
        },
      });

      if (!lessonPdf) {
        throw new NotFoundException('Lesson PDF not found');
      }

      return lessonPdf;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to load lesson PDF ${lessonPdfId} for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  private async upsertActiveDownload(
    userId: string,
    lessonVideoId: string,
    deviceHash: string,
  ): Promise<VideoDownload> {
    const existingDownload = await this.prismaService.videoDownload.findFirst({
      where: {
        userId,
        lessonVideoId,
        deviceHash,
        revokedAt: null,
      },
      orderBy: { downloadedAt: 'desc' },
    });

    if (existingDownload) {
      return this.prismaService.videoDownload.update({
        where: { id: existingDownload.id },
        data: { downloadedAt: new Date() },
      });
    }

    return this.prismaService.videoDownload.create({
      data: {
        userId,
        lessonVideoId,
        deviceHash,
      },
    });
  }

  private isDownloadAccessValid(
    user: User,
    download: VideoDownload & {
      lessonVideo: {
        lesson: Lesson & {
          chapter: {
            isPublished: boolean;
            unit: {
              isPublished: boolean;
              region: User['region'] | 'both';
            };
          };
        };
      };
    },
    hasActiveSubscription: boolean,
  ): boolean {
    if (download.revokedAt !== null) {
      return false;
    }

    const lesson = download.lessonVideo.lesson;
    const chapter = lesson.chapter;
    const unit = chapter.unit;

    if (!lesson.isPublished || !chapter.isPublished || !unit.isPublished) {
      return false;
    }

    const regionMatches = unit.region === 'both' || unit.region === user.region;

    if (!regionMatches) {
      return false;
    }

    return !computeIsLocked(lesson.accessLevel, hasActiveSubscription);
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
