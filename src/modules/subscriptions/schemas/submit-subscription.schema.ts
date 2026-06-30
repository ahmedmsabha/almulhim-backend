import { z } from 'zod';

export const submitSubscriptionSchema = z.object({
  planId: z.string().uuid(),
  senderName: z.string().trim().min(2).max(120),
  receiptStorageKey: z.string().trim().min(1).max(500),
});

export type SubmitSubscriptionInput = z.infer<typeof submitSubscriptionSchema>;
