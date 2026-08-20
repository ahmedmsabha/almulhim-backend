import type { ObjectMetadata } from '../../../lib/storage/r2-storage.service';
import {
  ALLOWED_HOME_VIDEO_CONTENT_TYPES,
  MAX_HOME_VIDEO_SIZE_BYTES,
  type AllowedHomeVideoContentType,
} from '../constants/home-video-upload.constants';

export type HomeVideoObjectValidationError =
  | 'missing'
  | 'invalid_type'
  | 'empty'
  | 'too_large';

export type HomeVideoObjectValidationResult =
  | { valid: true; contentType: AllowedHomeVideoContentType }
  | { valid: false; error: HomeVideoObjectValidationError };

const normalizeContentType = (
  contentType: string | undefined,
): string | undefined => contentType?.split(';')[0]?.trim().toLowerCase();

export const validateHomeVideoObjectMetadata = (
  metadata: ObjectMetadata | null,
): HomeVideoObjectValidationResult => {
  if (!metadata) {
    return { valid: false, error: 'missing' };
  }

  const contentType = normalizeContentType(metadata.contentType);

  if (
    !contentType ||
    !ALLOWED_HOME_VIDEO_CONTENT_TYPES.includes(
      contentType as AllowedHomeVideoContentType,
    )
  ) {
    return { valid: false, error: 'invalid_type' };
  }

  if (metadata.contentLength === undefined || metadata.contentLength < 1) {
    return { valid: false, error: 'empty' };
  }

  if (metadata.contentLength > MAX_HOME_VIDEO_SIZE_BYTES) {
    return { valid: false, error: 'too_large' };
  }

  return {
    valid: true,
    contentType: contentType as AllowedHomeVideoContentType,
  };
};

export const homeVideoValidationErrorMessage = (
  error: HomeVideoObjectValidationError,
): string => {
  switch (error) {
    case 'missing':
      return 'Video file was not found in storage';
    case 'invalid_type':
      return 'Video file type is not allowed';
    case 'empty':
      return 'Video file was not uploaded';
    case 'too_large':
      return 'Video file exceeds maximum size';
  }
};
