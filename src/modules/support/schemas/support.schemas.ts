import { z } from 'zod';

export const createSupportRequestSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
});

export type CreateSupportRequestInput = z.infer<
  typeof createSupportRequestSchema
>;

export const replySupportRequestSchema = z.object({
  reply: z.string().trim().min(1).max(5000),
});

export type ReplySupportRequestInput = z.infer<
  typeof replySupportRequestSchema
>;

export const listSupportRequestsQuerySchema = z.object({
  status: z.enum(['open', 'reviewed', 'closed']).optional(),
});

export type ListSupportRequestsQueryInput = z.infer<
  typeof listSupportRequestsQuerySchema
>;
