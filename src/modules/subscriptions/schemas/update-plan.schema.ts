import { z } from 'zod';

export const updatePlanSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).nullable(),
    priceAmount: z.number().int().positive(),
    currency: z.string().trim().length(3),
    durationDays: z.number().int().positive(),
    sortOrder: z.number().int().min(0),
    isActive: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
