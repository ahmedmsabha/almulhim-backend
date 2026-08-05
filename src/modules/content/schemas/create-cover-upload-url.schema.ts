import { z } from 'zod';

export const createCoverUploadUrlSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

export type CreateCoverUploadUrlInput = z.infer<
  typeof createCoverUploadUrlSchema
>;
