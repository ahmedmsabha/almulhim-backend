export type PublicPreviewCategory = 'foundation' | 'curriculum' | 'other';

export type PublicPreviewLessonSummary = {
  id: string;
  title: string;
  unitTitle: string;
  chapterTitle: string;
  category: PublicPreviewCategory;
  videoCount: number;
  totalDurationSeconds: number | null;
  primaryVideoId: string | null;
};

export type PublicPreviewLessonListResponse = {
  lessons: PublicPreviewLessonSummary[];
};

export type PublicPreviewVideoSummary = {
  id: string;
  title: string | null;
  durationSeconds: number | null;
  sortOrder: number;
};

export type PublicPreviewLessonDetailResponse = PublicPreviewLessonSummary & {
  videos: PublicPreviewVideoSummary[];
  playbackUrl: string | null;
  playbackExpiresInSeconds: number | null;
};
