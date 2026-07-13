import { z } from 'zod';

export const updateChapterSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    sortOrder: z.number().int().min(0),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
