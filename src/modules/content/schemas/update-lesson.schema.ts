import { z } from 'zod';

export const updateLessonSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    accessLevel: z.enum(['preview', 'subscriber_only']),
    sortOrder: z.number().int().min(0),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
