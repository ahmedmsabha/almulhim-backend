import type { ObjectMetadata } from '../../../lib/storage/r2-storage.service';
import {
  validateAnnouncementImageMetadata,
  announcementImageValidationErrorMessage,
} from './announcement-object.validation';

describe('validateAnnouncementImageMetadata', () => {
  it('accepts a valid JPEG image', () => {
    expect(
      validateAnnouncementImageMetadata({
        contentType: 'image/jpeg',
        contentLength: 1024,
      }),
    ).toEqual({ valid: true, contentType: 'image/jpeg' });
  });

  it('rejects missing metadata', () => {
    expect(validateAnnouncementImageMetadata(null)).toEqual({
      valid: false,
      error: 'missing',
    });
  });

  it('rejects invalid content type', () => {
    expect(
      validateAnnouncementImageMetadata({
        contentType: 'application/pdf',
        contentLength: 1024,
      } as ObjectMetadata),
    ).toEqual({ valid: false, error: 'invalid_type' });
  });

  it('maps validation errors to messages', () => {
    expect(announcementImageValidationErrorMessage('too_large')).toBe(
      'Announcement image exceeds maximum size',
    );
  });
});
