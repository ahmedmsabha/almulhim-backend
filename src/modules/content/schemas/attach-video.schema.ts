import { z } from 'zod';

export const attachVideoSchema = z.object({
  storageKey: z.string().trim().min(1).max(500),
  title: z.string().trim().min(1).max(200).optional(),
  sortOrder: z.number().int().min(0).default(0),
  durationSeconds: z.number().int().positive().optional(),
});

export type AttachVideoInput = z.infer<typeof attachVideoSchema>;
