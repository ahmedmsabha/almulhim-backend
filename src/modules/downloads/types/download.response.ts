import type { VideoDownload } from '../../../generated/prisma/client';

export type VideoDownloadAuthorizeResponse = {
  downloadId: string;
  /** R2 signed GET URL (offline / download use). Prefer streamTicket for AVPlayer. */
  url: string;
  /**
   * HMAC ticket for `GET|HEAD /downloads/videos/:id/stream?ticket=…`.
   * Needed because expo-video/AVPlayer often cannot attach Authorization headers.
   */
  streamTicket: string;
  expiresAt: string;
};

/** Short-lived signed GET URL for in-app PDF viewing (no download record). */
export type PdfViewAuthorizeResponse = {
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
  streamTicket: string,
  expiresAt: Date,
): VideoDownloadAuthorizeResponse => ({
  downloadId: download.id,
  url,
  streamTicket,
  expiresAt: expiresAt.toISOString(),
});

export const toPdfViewAuthorizeResponse = (
  url: string,
  expiresAt: Date,
): PdfViewAuthorizeResponse => ({
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
