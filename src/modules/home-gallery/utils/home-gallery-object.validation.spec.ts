import {
  validateHomeGalleryImageMetadata,
  homeGalleryImageValidationErrorMessage,
} from './home-gallery-object.validation';

describe('validateHomeGalleryImageMetadata', () => {
  it('accepts a valid JPEG image', () => {
    expect(
      validateHomeGalleryImageMetadata({
        contentType: 'image/jpeg',
        contentLength: 1024,
      }),
    ).toEqual({ valid: true, contentType: 'image/jpeg' });
  });

  it('rejects missing metadata', () => {
    expect(validateHomeGalleryImageMetadata(null)).toEqual({
      valid: false,
      error: 'missing',
    });
  });

  it('rejects invalid content type', () => {
    expect(
      validateHomeGalleryImageMetadata({
        contentType: 'application/pdf',
        contentLength: 1024,
      }),
    ).toEqual({ valid: false, error: 'invalid_type' });
  });

  it('maps validation errors to messages', () => {
    expect(homeGalleryImageValidationErrorMessage('too_large')).toBe(
      'Gallery image exceeds maximum size',
    );
  });
});
