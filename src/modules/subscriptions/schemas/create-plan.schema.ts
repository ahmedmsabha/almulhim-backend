import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  priceAmount: z.number().int().positive(),
  currency: z.string().trim().length(3).default('ILS'),
  durationDays: z.number().int().positive(),
  sortOrder: z.number().int().min(0).default(0),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
