import type {
  Chapter,
  Lesson,
  LessonAccessLevel,
  LessonPdf,
  LessonVideo,
  Unit,
} from '../../../generated/prisma/client';
import { computeIsLocked } from '../utils/content-access.utils';

export type ContentSearchResponse = {
  matchingIds: string[];
};

export type LessonSummaryResponse = {
  id: string;
  title: string;
  sortOrder: number;
  accessLevel: LessonAccessLevel;
  isLocked: boolean;
};

export type LessonVideoResponse = {
  id: string;
  title: string | null;
  durationSeconds: number | null;
  sortOrder: number;
};

export type LessonPdfResponse = {
  id: string;
  title: string | null;
  sortOrder: number;
};

export type LessonDetailResponse = LessonSummaryResponse & {
  chapterId: string;
  videos: LessonVideoResponse[];
  pdfs: LessonPdfResponse[];
};

export type ChapterSummaryResponse = {
  id: string;
  title: string;
  sortOrder: number;
};

export type ChapterDetailResponse = ChapterSummaryResponse & {
  unitId: string;
  lessons: LessonSummaryResponse[];
};

export type ContentTreeChapterResponse = ChapterSummaryResponse & {
  lessons: LessonSummaryResponse[];
};

export type UnitSummaryResponse = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
};

export type UnitDetailResponse = UnitSummaryResponse & {
  chapters: ChapterSummaryResponse[];
};

export type ContentTreeUnitResponse = UnitSummaryResponse & {
  chapters: ContentTreeChapterResponse[];
};

export type UnitListResponse = {
  units: UnitSummaryResponse[];
};

export type ContentTreeResponse = {
  units: ContentTreeUnitResponse[];
};

type LessonWithMedia = Lesson & {
  videos: LessonVideo[];
  pdfs: LessonPdf[];
};

export function toUnitSummaryResponse(unit: Unit): UnitSummaryResponse {
  return {
    id: unit.id,
    title: unit.title,
    description: unit.description,
    sortOrder: unit.sortOrder,
  };
}

export function toChapterSummaryResponse(
  chapter: Chapter,
): ChapterSummaryResponse {
  return {
    id: chapter.id,
    title: chapter.title,
    sortOrder: chapter.sortOrder,
  };
}

export function toLessonSummaryResponse(
  lesson: Lesson,
  hasActiveSubscription: boolean,
): LessonSummaryResponse {
  return {
    id: lesson.id,
    title: lesson.title,
    sortOrder: lesson.sortOrder,
    accessLevel: lesson.accessLevel,
    isLocked: computeIsLocked(lesson.accessLevel, hasActiveSubscription),
  };
}

export function toLessonVideoResponse(video: LessonVideo): LessonVideoResponse {
  return {
    id: video.id,
    title: video.title,
    durationSeconds: video.durationSeconds,
    sortOrder: video.sortOrder,
  };
}

export function toLessonPdfResponse(pdf: LessonPdf): LessonPdfResponse {
  return {
    id: pdf.id,
    title: pdf.title,
    sortOrder: pdf.sortOrder,
  };
}

export function toLessonDetailResponse(
  lesson: LessonWithMedia,
  hasActiveSubscription: boolean,
): LessonDetailResponse {
  const summary = toLessonSummaryResponse(lesson, hasActiveSubscription);

  if (summary.isLocked) {
    return {
      ...summary,
      chapterId: lesson.chapterId,
      videos: [],
      pdfs: [],
    };
  }

  return {
    ...summary,
    chapterId: lesson.chapterId,
    videos: lesson.videos.map(toLessonVideoResponse),
    pdfs: lesson.pdfs.map(toLessonPdfResponse),
  };
}
