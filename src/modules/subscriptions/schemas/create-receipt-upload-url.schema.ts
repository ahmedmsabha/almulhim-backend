import { z } from 'zod';
import { ALLOWED_RECEIPT_CONTENT_TYPES } from '../constants/receipt-upload.constants';

export const createReceiptUploadUrlSchema = z.object({
  contentType: z.enum(ALLOWED_RECEIPT_CONTENT_TYPES),
});

export type CreateReceiptUploadUrlInput = z.infer<
  typeof createReceiptUploadUrlSchema
>;
