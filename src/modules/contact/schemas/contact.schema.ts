import { z } from 'zod';

export const createContactMessageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(10).max(5000),
  phone: z.string().trim().min(6).max(40).optional(),
});

export type CreateContactMessageInput = z.infer<
  typeof createContactMessageSchema
>;
