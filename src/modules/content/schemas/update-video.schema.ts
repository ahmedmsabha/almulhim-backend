import { z } from 'zod';

export const updateVideoSchema = z
  .object({
    title: z.string().trim().min(1).max(200).nullable(),
    sortOrder: z.number().int().min(0),
    durationSeconds: z.number().int().positive().nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;
