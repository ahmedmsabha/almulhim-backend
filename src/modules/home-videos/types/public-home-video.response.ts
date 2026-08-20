export type PublicHomeVideoSummary = {
  id: string;
  title: string;
  sortOrder: number;
  playbackUrl: string;
  playbackExpiresInSeconds: number;
};

export type PublicHomeVideoListResponse = {
  homeVideos: PublicHomeVideoSummary[];
};
