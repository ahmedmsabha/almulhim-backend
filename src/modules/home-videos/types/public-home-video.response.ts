import type { HomeVideoTitleLine } from '../utils/home-video-title-lines';

export type PublicHomeVideoSummary = {
  id: string;
  title: string;
  titleLines: HomeVideoTitleLine[] | null;
  sortOrder: number;
  playbackUrl: string;
  playbackExpiresInSeconds: number;
};

export type PublicHomeVideoListResponse = {
  homeVideos: PublicHomeVideoSummary[];
};
