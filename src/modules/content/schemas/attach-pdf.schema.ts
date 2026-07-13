import { z } from 'zod';

export const attachPdfSchema = z.object({
  storageKey: z.string().trim().min(1).max(500),
  title: z.string().trim().min(1).max(200).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export type AttachPdfInput = z.infer<typeof attachPdfSchema>;
