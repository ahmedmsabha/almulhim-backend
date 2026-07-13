import type { VideoDownload } from '../../../generated/prisma/client';

export type VideoDownloadAuthorizeResponse = {
  downloadId: string;
  url: string;
  expiresAt: string;
};

export type VideoDownloadSyncItemResponse = {
  id: string;
  lessonVideoId: string;
  downloadedAt: string;
  revokedAt: string | null;
  isRevoked: boolean;
  isAccessValid: boolean;
};

export type VideoDownloadListResponse = {
  downloads: VideoDownloadSyncItemResponse[];
};

export const toVideoDownloadAuthorizeResponse = (
  download: VideoDownload,
  url: string,
  expiresAt: Date,
): VideoDownloadAuthorizeResponse => ({
  downloadId: download.id,
  url,
  expiresAt: expiresAt.toISOString(),
});

export const toVideoDownloadSyncItemResponse = (
  download: VideoDownload,
  isAccessValid: boolean,
): VideoDownloadSyncItemResponse => ({
  id: download.id,
  lessonVideoId: download.lessonVideoId,
  downloadedAt: download.downloadedAt.toISOString(),
  revokedAt: download.revokedAt?.toISOString() ?? null,
  isRevoked: download.revokedAt !== null,
  isAccessValid,
});
