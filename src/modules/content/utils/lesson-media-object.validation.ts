import type { ObjectMetadata } from '../../../lib/storage/r2-storage.service';
import {
  ALLOWED_PDF_CONTENT_TYPES,
  ALLOWED_VIDEO_CONTENT_TYPES,
  MAX_PDF_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  type AllowedPdfContentType,
  type AllowedVideoContentType,
} from '../constants/content-upload.constants';

export type LessonMediaObjectValidationError =
  | 'missing'
  | 'invalid_type'
  | 'empty'
  | 'too_large';

export type LessonMediaObjectValidationResult =
  | { valid: true; contentType: AllowedVideoContentType | AllowedPdfContentType }
  | { valid: false; error: LessonMediaObjectValidationError };

const normalizeContentType = (
  contentType: string | undefined,
): string | undefined =>
  contentType?.split(';')[0]?.trim().toLowerCase();

const validateObjectMetadata = (
  metadata: ObjectMetadata | null,
  allowedContentTypes: readonly string[],
  maxSizeBytes: number,
): LessonMediaObjectValidationResult => {
  if (!metadata) {
    return { valid: false, error: 'missing' };
  }

  const contentType = normalizeContentType(metadata.contentType);

  if (
    !contentType ||
    !allowedContentTypes.includes(contentType)
  ) {
    return { valid: false, error: 'invalid_type' };
  }

  if (
    metadata.contentLength === undefined ||
    metadata.contentLength < 1
  ) {
    return { valid: false, error: 'empty' };
  }

  if (metadata.contentLength > maxSizeBytes) {
    return { valid: false, error: 'too_large' };
  }

  return {
    valid: true,
    contentType: contentType as AllowedVideoContentType | AllowedPdfContentType,
  };
};

export const validateVideoObjectMetadata = (
  metadata: ObjectMetadata | null,
): LessonMediaObjectValidationResult =>
  validateObjectMetadata(
    metadata,
    ALLOWED_VIDEO_CONTENT_TYPES,
    MAX_VIDEO_SIZE_BYTES,
  );

export const validatePdfObjectMetadata = (
  metadata: ObjectMetadata | null,
): LessonMediaObjectValidationResult =>
  validateObjectMetadata(
    metadata,
    ALLOWED_PDF_CONTENT_TYPES,
    MAX_PDF_SIZE_BYTES,
  );

export const lessonMediaValidationErrorMessage = (
  error: LessonMediaObjectValidationError,
  mediaKind: 'video' | 'pdf',
): string => {
  const label = mediaKind === 'video' ? 'Video' : 'PDF';

  switch (error) {
    case 'missing':
      return `${label} file was not found in storage`;
    case 'invalid_type':
      return `${label} file type is not allowed`;
    case 'empty':
      return `${label} file was not uploaded`;
    case 'too_large':
      return `${label} file exceeds maximum size`;
  }
};
