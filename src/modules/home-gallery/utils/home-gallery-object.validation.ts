import type { ObjectMetadata } from '../../../lib/storage/r2-storage.service';
import {
  ALLOWED_HOME_GALLERY_IMAGE_CONTENT_TYPES,
  MAX_HOME_GALLERY_IMAGE_SIZE_BYTES,
  type AllowedHomeGalleryImageContentType,
} from '../constants/home-gallery-upload.constants';

export type HomeGalleryImageValidationError =
  | 'missing'
  | 'invalid_type'
  | 'empty'
  | 'too_large';

export type HomeGalleryImageValidationResult =
  | { valid: true; contentType: AllowedHomeGalleryImageContentType }
  | { valid: false; error: HomeGalleryImageValidationError };

const normalizeContentType = (
  contentType: string | undefined,
): string | undefined => contentType?.split(';')[0]?.trim().toLowerCase();

export const validateHomeGalleryImageMetadata = (
  metadata: ObjectMetadata | null,
): HomeGalleryImageValidationResult => {
  if (!metadata) {
    return { valid: false, error: 'missing' };
  }

  const contentType = normalizeContentType(metadata.contentType);

  if (
    !contentType ||
    !ALLOWED_HOME_GALLERY_IMAGE_CONTENT_TYPES.includes(
      contentType as AllowedHomeGalleryImageContentType,
    )
  ) {
    return { valid: false, error: 'invalid_type' };
  }

  if (metadata.contentLength === undefined || metadata.contentLength < 1) {
    return { valid: false, error: 'empty' };
  }

  if (metadata.contentLength > MAX_HOME_GALLERY_IMAGE_SIZE_BYTES) {
    return { valid: false, error: 'too_large' };
  }

  return {
    valid: true,
    contentType: contentType as AllowedHomeGalleryImageContentType,
  };
};

export const homeGalleryImageValidationErrorMessage = (
  error: HomeGalleryImageValidationError,
): string => {
  switch (error) {
    case 'missing':
      return 'Gallery image was not found in storage';
    case 'invalid_type':
      return 'Gallery image type is not allowed';
    case 'empty':
      return 'Gallery image was not uploaded';
    case 'too_large':
      return 'Gallery image exceeds maximum size';
  }
};
