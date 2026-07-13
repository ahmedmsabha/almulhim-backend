import type { ObjectMetadata } from '../../../lib/storage/r2-storage.service';
import {
  ALLOWED_ANNOUNCEMENT_IMAGE_CONTENT_TYPES,
  MAX_ANNOUNCEMENT_IMAGE_SIZE_BYTES,
  type AllowedAnnouncementImageContentType,
} from '../constants/announcement-upload.constants';

export type AnnouncementImageValidationError =
  | 'missing'
  | 'invalid_type'
  | 'empty'
  | 'too_large';

export type AnnouncementImageValidationResult =
  | { valid: true; contentType: AllowedAnnouncementImageContentType }
  | { valid: false; error: AnnouncementImageValidationError };

export const validateAnnouncementImageMetadata = (
  metadata: ObjectMetadata | null,
): AnnouncementImageValidationResult => {
  if (!metadata) {
    return { valid: false, error: 'missing' };
  }

  const contentType = metadata.contentType
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();

  if (
    !contentType ||
    !(ALLOWED_ANNOUNCEMENT_IMAGE_CONTENT_TYPES as readonly string[]).includes(
      contentType,
    )
  ) {
    return { valid: false, error: 'invalid_type' };
  }

  if (metadata.contentLength === undefined || metadata.contentLength < 1) {
    return { valid: false, error: 'empty' };
  }

  if (metadata.contentLength > MAX_ANNOUNCEMENT_IMAGE_SIZE_BYTES) {
    return { valid: false, error: 'too_large' };
  }

  return {
    valid: true,
    contentType: contentType as AllowedAnnouncementImageContentType,
  };
};

export const announcementImageValidationErrorMessage = (
  error: AnnouncementImageValidationError,
): string => {
  switch (error) {
    case 'missing':
      return 'Announcement image was not found in storage';
    case 'invalid_type':
      return 'Announcement image type is not allowed';
    case 'empty':
      return 'Announcement image was not uploaded';
    case 'too_large':
      return 'Announcement image exceeds maximum size';
  }
};
