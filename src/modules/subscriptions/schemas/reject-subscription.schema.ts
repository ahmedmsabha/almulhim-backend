import { z } from 'zod';

export const rejectSubscriptionSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(1000).optional(),
});

export type RejectSubscriptionInput = z.infer<typeof rejectSubscriptionSchema>;
