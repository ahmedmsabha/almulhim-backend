import { z } from 'zod';

export const STUDENT_SUBSCRIPTION_STATUSES = [
  'free',
  'pending_review',
  'pending_approval',
  'active',
  'expired',
  'rejected',
  'suspended',
] as const;

export type StudentSubscriptionStatus =
  (typeof STUDENT_SUBSCRIPTION_STATUSES)[number];

export const listStudentsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  region: z.enum(['gaza', 'west_bank']).optional(),
  status: z.enum(STUDENT_SUBSCRIPTION_STATUSES).optional(),
  /** When true, include soft-blocked students (`deactivatedAt` set). Default excludes them. */
  includeDeactivated: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return false;
      }

      return value === true || value === 'true' || value === '1';
    }),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type ListStudentsQueryInput = z.infer<typeof listStudentsQuerySchema>;
