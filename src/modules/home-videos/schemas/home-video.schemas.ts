import { z } from 'zod';

import { homeVideoTitleLinesSchema } from '../utils/home-video-title-lines';

export const createHomeVideoSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    titleLines: homeVideoTitleLinesSchema.optional(),
    sortOrder: z.number().int().min(0).default(0),
  })
  .refine((value) => Boolean(value.title ?? value.titleLines), {
    message: 'Either title or titleLines is required',
    path: ['title'],
  });

export const updateHomeVideoSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    titleLines: homeVideoTitleLinesSchema.optional(),
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
