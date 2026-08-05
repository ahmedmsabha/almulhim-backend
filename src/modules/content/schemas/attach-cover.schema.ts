import { z } from 'zod';

export const attachCoverSchema = z.object({
  storageKey: z.string().trim().min(1).max(500),
});

export type AttachCoverInput = z.infer<typeof attachCoverSchema>;
