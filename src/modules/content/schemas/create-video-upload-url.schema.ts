import { z } from 'zod';

export const createVideoUploadUrlSchema = z.object({
  contentType: z.literal('video/mp4'),
});

export type CreateVideoUploadUrlInput = z.infer<
  typeof createVideoUploadUrlSchema
>;
