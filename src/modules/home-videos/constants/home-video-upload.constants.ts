export const ALLOWED_HOME_VIDEO_CONTENT_TYPES = ['video/mp4'] as const;

export type AllowedHomeVideoContentType =
  (typeof ALLOWED_HOME_VIDEO_CONTENT_TYPES)[number];

export const HOME_VIDEO_CONTENT_TYPE_EXTENSION: Record<
  AllowedHomeVideoContentType,
  string
> = {
  'video/mp4': 'mp4',
};

export const MAX_HOME_VIDEO_SIZE_BYTES = 1024 * 1024 * 1024;

export const HOME_VIDEO_UPLOAD_EXPIRES_SECONDS = 15 * 60;

export const HOME_VIDEO_PLAYBACK_URL_EXPIRES_SECONDS = 15 * 60;

export const HOME_VIDEO_KEY_PREFIX = 'home-videos';

const OBJECT_ID_PATTERN =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildHomeVideoStorageKeyPattern = (homeVideoId: string): RegExp =>
  new RegExp(
    `^${HOME_VIDEO_KEY_PREFIX}/${escapeRegExp(homeVideoId)}/${OBJECT_ID_PATTERN}\\.mp4$`,
    'i',
  );
