export const ALLOWED_VIDEO_CONTENT_TYPES = ['video/mp4'] as const;

export type AllowedVideoContentType =
  (typeof ALLOWED_VIDEO_CONTENT_TYPES)[number];

export const ALLOWED_PDF_CONTENT_TYPES = ['application/pdf'] as const;

export type AllowedPdfContentType = (typeof ALLOWED_PDF_CONTENT_TYPES)[number];

export const VIDEO_CONTENT_TYPE_EXTENSION: Record<
  AllowedVideoContentType,
  string
> = {
  'video/mp4': 'mp4',
};

export const PDF_CONTENT_TYPE_EXTENSION: Record<AllowedPdfContentType, string> =
  {
    'application/pdf': 'pdf',
  };

export const MAX_VIDEO_SIZE_BYTES = 1024 * 1024 * 1024;

export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024;

export const CONTENT_UPLOAD_EXPIRES_SECONDS = 15 * 60;

export const VIDEO_KEY_PREFIX = 'videos';

export const PDF_KEY_PREFIX = 'pdfs';

const OBJECT_ID_PATTERN =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildVideoStorageKeyPattern = (lessonId: string): RegExp =>
  new RegExp(
    `^${VIDEO_KEY_PREFIX}/${escapeRegExp(lessonId)}/${OBJECT_ID_PATTERN}\\.mp4$`,
    'i',
  );

export const buildPdfStorageKeyPattern = (lessonId: string): RegExp =>
  new RegExp(
    `^${PDF_KEY_PREFIX}/${escapeRegExp(lessonId)}/${OBJECT_ID_PATTERN}\\.pdf$`,
    'i',
  );
