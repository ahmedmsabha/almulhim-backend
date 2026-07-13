import { z } from 'zod';

export const createChapterSchema = z.object({
  title: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).default(0),
});

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
