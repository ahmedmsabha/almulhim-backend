import type { ObjectMetadata } from '../../../lib/storage/r2-storage.service';
import {
  validatePdfObjectMetadata,
  validateVideoObjectMetadata,
} from './lesson-media-object.validation';

describe('lesson-media-object.validation', () => {
  const validVideoMetadata: ObjectMetadata = {
    contentType: 'video/mp4',
    contentLength: 1024,
  };

  const validPdfMetadata: ObjectMetadata = {
    contentType: 'application/pdf',
    contentLength: 2048,
  };

  describe('validateVideoObjectMetadata', () => {
    it('accepts valid mp4 metadata', () => {
      expect(validateVideoObjectMetadata(validVideoMetadata)).toEqual({
        valid: true,
        contentType: 'video/mp4',
      });
    });

    it('rejects missing object', () => {
      expect(validateVideoObjectMetadata(null)).toEqual({
        valid: false,
        error: 'missing',
      });
    });

    it('rejects invalid content type', () => {
      expect(
        validateVideoObjectMetadata({
          contentType: 'video/webm',
          contentLength: 1024,
        }),
      ).toEqual({
        valid: false,
        error: 'invalid_type',
      });
    });

    it('rejects empty file', () => {
      expect(
        validateVideoObjectMetadata({
          contentType: 'video/mp4',
          contentLength: 0,
        }),
      ).toEqual({
        valid: false,
        error: 'empty',
      });
    });

    it('rejects files over 1 GB', () => {
      expect(
        validateVideoObjectMetadata({
          contentType: 'video/mp4',
          contentLength: 1024 * 1024 * 1024 + 1,
        }),
      ).toEqual({
        valid: false,
        error: 'too_large',
      });
    });
  });

  describe('validatePdfObjectMetadata', () => {
    it('accepts valid pdf metadata', () => {
      expect(validatePdfObjectMetadata(validPdfMetadata)).toEqual({
        valid: true,
        contentType: 'application/pdf',
      });
    });

    it('rejects files over 50 MB', () => {
      expect(
        validatePdfObjectMetadata({
          contentType: 'application/pdf',
          contentLength: 50 * 1024 * 1024 + 1,
        }),
      ).toEqual({
        valid: false,
        error: 'too_large',
      });
    });
  });
});
