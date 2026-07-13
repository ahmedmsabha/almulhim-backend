import type { ObjectMetadata } from '../../../lib/storage/r2-storage.service';
import {
  ALLOWED_RECEIPT_CONTENT_TYPES,
  MAX_RECEIPT_SIZE_BYTES,
  type AllowedReceiptContentType,
} from '../constants/receipt-upload.constants';

export type ReceiptObjectValidationError =
  | 'missing'
  | 'invalid_type'
  | 'empty'
  | 'too_large';

export type ReceiptObjectValidationResult =
  | { valid: true; contentType: AllowedReceiptContentType }
  | { valid: false; error: ReceiptObjectValidationError };

export const validateReceiptObjectMetadata = (
  metadata: ObjectMetadata | null,
): ReceiptObjectValidationResult => {
  if (!metadata) {
    return { valid: false, error: 'missing' };
  }

  const contentType = metadata.contentType
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();

  if (
    !contentType ||
    !(ALLOWED_RECEIPT_CONTENT_TYPES as readonly string[]).includes(contentType)
  ) {
    return { valid: false, error: 'invalid_type' };
  }

  if (
    metadata.contentLength === undefined ||
    metadata.contentLength < 1
  ) {
    return { valid: false, error: 'empty' };
  }

  if (metadata.contentLength > MAX_RECEIPT_SIZE_BYTES) {
    return { valid: false, error: 'too_large' };
  }

  return {
    valid: true,
    contentType: contentType as AllowedReceiptContentType,
  };
};

export const receiptValidationErrorMessage = (
  error: ReceiptObjectValidationError,
): string => {
  switch (error) {
    case 'missing':
      return 'Receipt file was not found in storage';
    case 'invalid_type':
      return 'Receipt file type is not allowed';
    case 'empty':
      return 'Receipt file was not uploaded';
    case 'too_large':
      return 'Receipt file exceeds maximum size';
  }
};
