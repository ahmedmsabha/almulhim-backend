import type { Announcement } from '../../../generated/prisma/client';

export type AnnouncementSummaryResponse = {
  id: string;
  title: string;
  body: string;
  region: Announcement['region'];
  publishedAt: string;
  imageUrl: string | null;
};

export type AnnouncementListResponse = {
  announcements: AnnouncementSummaryResponse[];
};

export const toAnnouncementSummaryResponse = (
  announcement: Announcement,
  imageUrl: string | null,
): AnnouncementSummaryResponse => ({
  id: announcement.id,
  title: announcement.title,
  body: announcement.body,
  region: announcement.region,
  publishedAt: announcement.publishedAt?.toISOString() ?? '',
  imageUrl,
});
