import { z } from 'zod';

export const createHomeVideoSchema = z.object({
  title: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateHomeVideoSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const createHomeVideoUploadUrlSchema = z.object({
  contentType: z.literal('video/mp4'),
});

export const attachHomeVideoSchema = z.object({
  storageKey: z.string().trim().min(1).max(500),
});

export type CreateHomeVideoInput = z.infer<typeof createHomeVideoSchema>;
export type UpdateHomeVideoInput = z.infer<typeof updateHomeVideoSchema>;
export type CreateHomeVideoUploadUrlInput = z.infer<
  typeof createHomeVideoUploadUrlSchema
>;
export type AttachHomeVideoInput = z.infer<typeof attachHomeVideoSchema>;
