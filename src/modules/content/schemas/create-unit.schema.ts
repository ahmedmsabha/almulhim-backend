import { z } from 'zod';

export const createUnitSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  region: z.enum(['gaza', 'west_bank', 'both']),
  sortOrder: z.number().int().min(0).default(0),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
