import type { Announcement } from '../../../generated/prisma/client';

export type AdminAnnouncementSummaryResponse = {
  id: string;
  title: string;
  body: string;
  region: Announcement['region'];
  imageStorageKey: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAnnouncementListResponse = {
  announcements: AdminAnnouncementSummaryResponse[];
};

export type ImageUploadUrlResponse = {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
};

export const toAdminAnnouncementSummaryResponse = (
  announcement: Announcement,
): AdminAnnouncementSummaryResponse => ({
  id: announcement.id,
  title: announcement.title,
  body: announcement.body,
  region: announcement.region,
  imageStorageKey: announcement.imageStorageKey,
  isPublished: announcement.isPublished,
  publishedAt: announcement.publishedAt?.toISOString() ?? null,
  createdAt: announcement.createdAt.toISOString(),
  updatedAt: announcement.updatedAt.toISOString(),
});
