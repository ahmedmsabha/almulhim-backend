import { z } from 'zod';

export const updatePlanSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).nullable(),
    priceGaza: z.number().int().positive(),
    priceWestBank: z.number().int().positive(),
    currency: z.string().trim().length(3),
    accessEndsAt: z.coerce.date(),
    startsAt: z.coerce.date().nullable(),
    sortOrder: z.number().int().min(0),
    isActive: z.boolean(),
    unitIds: z.array(z.string().uuid()).min(1),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
