import type {
  Chapter,
  ContentRegion,
  Lesson,
  LessonAccessLevel,
  LessonPdf,
  LessonVideo,
  Unit,
} from '../../../generated/prisma/client';

export type AdminUnitSummaryResponse = {
  id: string;
  title: string;
  description: string | null;
  region: ContentRegion;
  sortOrder: number;
  isPublished: boolean;
  publishedAt: string | null;
};

export type AdminChapterSummaryResponse = {
  id: string;
  title: string;
  sortOrder: number;
  isPublished: boolean;
  publishedAt: string | null;
};

export type AdminLessonSummaryResponse = {
  id: string;
  title: string;
  sortOrder: number;
  accessLevel: LessonAccessLevel;
  isPublished: boolean;
  publishedAt: string | null;
};

export type AdminVideoResponse = {
  id: string;
  title: string | null;
  durationSeconds: number | null;
  sortOrder: number;
  storageKey: string;
};

export type AdminPdfResponse = {
  id: string;
  title: string | null;
  sortOrder: number;
  storageKey: string;
};

export type AdminLessonDetailResponse = AdminLessonSummaryResponse & {
  chapterId: string;
  videos: AdminVideoResponse[];
  pdfs: AdminPdfResponse[];
};

export type AdminChapterDetailResponse = AdminChapterSummaryResponse & {
  unitId: string;
  lessons: AdminLessonSummaryResponse[];
};

export type AdminUnitDetailResponse = AdminUnitSummaryResponse & {
  chapters: AdminChapterSummaryResponse[];
};

export type AdminContentTreeLessonResponse = AdminLessonSummaryResponse;

export type AdminContentTreeChapterResponse = AdminChapterSummaryResponse & {
  lessons: AdminContentTreeLessonResponse[];
};

export type AdminContentTreeUnitResponse = AdminUnitSummaryResponse & {
  chapters: AdminContentTreeChapterResponse[];
};

export type AdminContentTreeResponse = {
  units: AdminContentTreeUnitResponse[];
};

export type MediaUploadUrlResponse = {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
};

export type MediaViewUrlResponse = {
  url: string;
  expiresInSeconds: number;
};

const toIsoString = (value: Date | null): string | null =>
  value ? value.toISOString() : null;

export const toAdminUnitSummaryResponse = (
  unit: Unit,
): AdminUnitSummaryResponse => ({
  id: unit.id,
  title: unit.title,
  description: unit.description,
  region: unit.region,
  sortOrder: unit.sortOrder,
  isPublished: unit.isPublished,
  publishedAt: toIsoString(unit.publishedAt),
});

export const toAdminChapterSummaryResponse = (
  chapter: Chapter,
): AdminChapterSummaryResponse => ({
  id: chapter.id,
  title: chapter.title,
  sortOrder: chapter.sortOrder,
  isPublished: chapter.isPublished,
  publishedAt: toIsoString(chapter.publishedAt),
});

export const toAdminLessonSummaryResponse = (
  lesson: Lesson,
): AdminLessonSummaryResponse => ({
  id: lesson.id,
  title: lesson.title,
  sortOrder: lesson.sortOrder,
  accessLevel: lesson.accessLevel,
  isPublished: lesson.isPublished,
  publishedAt: toIsoString(lesson.publishedAt),
});

export const toAdminVideoResponse = (
  video: LessonVideo,
): AdminVideoResponse => ({
  id: video.id,
  title: video.title,
  durationSeconds: video.durationSeconds,
  sortOrder: video.sortOrder,
  storageKey: video.storageKey,
});

export const toAdminPdfResponse = (pdf: LessonPdf): AdminPdfResponse => ({
  id: pdf.id,
  title: pdf.title,
  sortOrder: pdf.sortOrder,
  storageKey: pdf.storageKey,
});

export const toAdminLessonDetailResponse = (
  lesson: Lesson & { videos: LessonVideo[]; pdfs: LessonPdf[] },
): AdminLessonDetailResponse => ({
  ...toAdminLessonSummaryResponse(lesson),
  chapterId: lesson.chapterId,
  videos: lesson.videos.map(toAdminVideoResponse),
  pdfs: lesson.pdfs.map(toAdminPdfResponse),
});
