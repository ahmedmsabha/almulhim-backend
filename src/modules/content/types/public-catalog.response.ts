export type PublicCatalogAccessLevel = 'preview' | 'subscriber_only';

export type PublicCatalogLesson = {
  id: string;
  title: string;
  sortOrder: number;
  accessLevel: PublicCatalogAccessLevel;
  isLocked: boolean;
  videoCount: number;
  pdfCount: number;
  coverUrl: string | null;
};

export type PublicCatalogChapter = {
  id: string;
  title: string;
  sortOrder: number;
  lessons: PublicCatalogLesson[];
};

export type PublicCatalogUnit = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  /** First available lesson cover in the unit, for catalog banners. */
  coverUrl: string | null;
  chapters: PublicCatalogChapter[];
};

export type PublicCatalogResponse = {
  units: PublicCatalogUnit[];
};
