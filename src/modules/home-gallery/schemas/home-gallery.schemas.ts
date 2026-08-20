import { z } from 'zod';

export const createHomeGallerySlideSchema = z.object({
  caption: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateHomeGallerySlideSchema = z
  .object({
    caption: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const createHomeGalleryImageUploadUrlSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

export const attachHomeGalleryImageSchema = z.object({
  storageKey: z.string().trim().min(1).max(500),
});

export type CreateHomeGallerySlideInput = z.infer<
  typeof createHomeGallerySlideSchema
>;
export type UpdateHomeGallerySlideInput = z.infer<
  typeof updateHomeGallerySlideSchema
>;
export type CreateHomeGalleryImageUploadUrlInput = z.infer<
  typeof createHomeGalleryImageUploadUrlSchema
>;
export type AttachHomeGalleryImageInput = z.infer<
  typeof attachHomeGalleryImageSchema
>;
