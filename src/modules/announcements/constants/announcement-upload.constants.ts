export const ALLOWED_ANNOUNCEMENT_IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedAnnouncementImageContentType =
  (typeof ALLOWED_ANNOUNCEMENT_IMAGE_CONTENT_TYPES)[number];

export const ANNOUNCEMENT_IMAGE_CONTENT_TYPE_EXTENSION: Record<
  AllowedAnnouncementImageContentType,
  string
> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_ANNOUNCEMENT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const ANNOUNCEMENT_UPLOAD_EXPIRES_SECONDS = 15 * 60;

export const ANNOUNCEMENT_IMAGE_VIEW_URL_EXPIRES_SECONDS = 15 * 60;

export const ANNOUNCEMENT_KEY_PREFIX = 'announcements';

const OBJECT_ID_PATTERN =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

const IMAGE_FILE_EXTENSION_PATTERN = '(jpg|png|webp)';

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildAnnouncementImageStorageKeyPattern = (
  announcementId: string,
): RegExp =>
  new RegExp(
    `^${ANNOUNCEMENT_KEY_PREFIX}/${escapeRegExp(announcementId)}/${OBJECT_ID_PATTERN}\\.${IMAGE_FILE_EXTENSION_PATTERN}$`,
    'i',
  );
