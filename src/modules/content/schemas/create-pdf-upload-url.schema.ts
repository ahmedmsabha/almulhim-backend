import { z } from 'zod';

export const createPdfUploadUrlSchema = z.object({
  contentType: z.literal('application/pdf'),
});

export type CreatePdfUploadUrlInput = z.infer<typeof createPdfUploadUrlSchema>;
