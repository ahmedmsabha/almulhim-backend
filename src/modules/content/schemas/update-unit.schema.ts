import { z } from 'zod';

export const updateUnitSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).nullable(),
    region: z.enum(['gaza', 'west_bank', 'both']),
    sortOrder: z.number().int().min(0),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
