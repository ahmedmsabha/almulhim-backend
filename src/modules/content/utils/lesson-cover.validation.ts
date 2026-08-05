import type { ObjectMetadata } from '../../../lib/storage/r2-storage.service';
import {
  ALLOWED_COVER_CONTENT_TYPES,
  MAX_COVER_SIZE_BYTES,
  type AllowedCoverContentType,
} from '../constants/content-upload.constants';

export type LessonCoverValidationError =
  | 'missing'
  | 'invalid_type'
  | 'empty'
  | 'too_large';

export type LessonCoverValidationResult =
  | { valid: true; contentType: AllowedCoverContentType }
  | { valid: false; error: LessonCoverValidationError };

export const validateLessonCoverMetadata = (
  metadata: ObjectMetadata | null,
): LessonCoverValidationResult => {
  if (!metadata) {
    return { valid: false, error: 'missing' };
  }

  const contentType = metadata.contentType?.split(';')[0]?.trim().toLowerCase();

  if (
    !contentType ||
    !(ALLOWED_COVER_CONTENT_TYPES as readonly string[]).includes(contentType)
  ) {
    return { valid: false, error: 'invalid_type' };
  }

  if (metadata.contentLength === undefined || metadata.contentLength < 1) {
    return { valid: false, error: 'empty' };
  }

  if (metadata.contentLength > MAX_COVER_SIZE_BYTES) {
    return { valid: false, error: 'too_large' };
  }

  return {
    valid: true,
    contentType: contentType as AllowedCoverContentType,
  };
};

export const lessonCoverValidationErrorMessage = (
  error: LessonCoverValidationError,
): string => {
  switch (error) {
    case 'missing':
      return 'Lesson cover was not found in storage';
    case 'invalid_type':
      return 'Lesson cover type is not allowed';
    case 'empty':
      return 'Lesson cover was not uploaded';
    case 'too_large':
      return 'Lesson cover exceeds maximum size';
  }
};
