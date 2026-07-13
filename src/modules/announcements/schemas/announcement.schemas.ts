import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  region: z.enum(['gaza', 'west_bank', 'both']),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const updateAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(10000),
    region: z.enum(['gaza', 'west_bank', 'both']),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

export const createImageUploadUrlSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

export type CreateImageUploadUrlInput = z.infer<
  typeof createImageUploadUrlSchema
>;

export const attachImageSchema = z.object({
  storageKey: z.string().trim().min(1).max(500),
});

export type AttachImageInput = z.infer<typeof attachImageSchema>;
