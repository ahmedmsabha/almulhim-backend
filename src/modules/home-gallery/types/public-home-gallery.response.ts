export type PublicHomeGallerySlideSummary = {
  id: string;
  caption: string;
  sortOrder: number;
  imageUrl: string;
};

export type PublicHomeGalleryListResponse = {
  slides: PublicHomeGallerySlideSummary[];
};
