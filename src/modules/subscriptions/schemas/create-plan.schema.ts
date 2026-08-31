import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  priceGaza: z.number().int().positive(),
  priceWestBank: z.number().int().positive(),
  currency: z.string().trim().length(3).default('ILS'),
  accessEndsAt: z.coerce.date(),
  startsAt: z.coerce.date().nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  unitIds: z.array(z.string().uuid()).min(1),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
