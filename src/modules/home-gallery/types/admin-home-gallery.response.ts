import type { HomeGallerySlide } from '../../../generated/prisma/client';

export type AdminHomeGallerySlideSummaryResponse = {
  id: string;
  caption: string;
  imageStorageKey: string | null;
  externalImageUrl: string | null;
  sortOrder: number;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminHomeGallerySlideListResponse = {
  slides: AdminHomeGallerySlideSummaryResponse[];
};

export type HomeGalleryImageUploadUrlResponse = {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
};

export type HomeGalleryImageUrlResponse = {
  url: string;
  expiresInSeconds: number;
};

export const toAdminHomeGallerySlideSummaryResponse = (
  slide: HomeGallerySlide,
): AdminHomeGallerySlideSummaryResponse => ({
  id: slide.id,
  caption: slide.caption,
  imageStorageKey: slide.imageStorageKey,
  externalImageUrl: slide.externalImageUrl,
  sortOrder: slide.sortOrder,
  isPublished: slide.isPublished,
  publishedAt: slide.publishedAt?.toISOString() ?? null,
  createdAt: slide.createdAt.toISOString(),
  updatedAt: slide.updatedAt.toISOString(),
});
