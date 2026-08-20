import type { HomeVideo } from '../../../generated/prisma/client';

export type AdminHomeVideoSummaryResponse = {
  id: string;
  title: string;
  storageKey: string | null;
  sortOrder: number;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminHomeVideoListResponse = {
  homeVideos: AdminHomeVideoSummaryResponse[];
};

export type HomeVideoUploadUrlResponse = {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
};

export type HomeVideoPlaybackUrlResponse = {
  url: string;
  expiresInSeconds: number;
};

export const toAdminHomeVideoSummaryResponse = (
  homeVideo: HomeVideo,
): AdminHomeVideoSummaryResponse => ({
  id: homeVideo.id,
  title: homeVideo.title,
  storageKey: homeVideo.storageKey,
  sortOrder: homeVideo.sortOrder,
  isPublished: homeVideo.isPublished,
  publishedAt: homeVideo.publishedAt?.toISOString() ?? null,
  createdAt: homeVideo.createdAt.toISOString(),
  updatedAt: homeVideo.updatedAt.toISOString(),
});
