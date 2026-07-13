import { z } from 'zod';

export const createLessonSchema = z.object({
  title: z.string().trim().min(1).max(200),
  accessLevel: z
    .enum(['preview', 'subscriber_only'])
    .default('subscriber_only'),
  sortOrder: z.number().int().min(0).default(0),
});

export type CreateLessonInput = z.infer<typeof createLessonSchema>;
