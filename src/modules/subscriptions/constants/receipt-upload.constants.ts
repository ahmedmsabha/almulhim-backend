import type { SubscriptionStatus } from '../../../generated/prisma/client';

export const OPEN_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'pending_review',
  'pending_approval',
  'active',
  'suspended',
];

export const ALLOWED_RECEIPT_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedReceiptContentType =
  (typeof ALLOWED_RECEIPT_CONTENT_TYPES)[number];

export const RECEIPT_CONTENT_TYPE_EXTENSION: Record<
  AllowedReceiptContentType,
  string
> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024;

export const RECEIPT_UPLOAD_EXPIRES_SECONDS = 15 * 60;

export const RECEIPT_KEY_PREFIX = 'receipts';

const RECEIPT_OBJECT_ID_PATTERN =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

const RECEIPT_FILE_EXTENSION_PATTERN = '(jpg|png|webp)';

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildReceiptStorageKeyPattern = (userId: string): RegExp =>
  new RegExp(
    `^${RECEIPT_KEY_PREFIX}/${escapeRegExp(userId)}/${RECEIPT_OBJECT_ID_PATTERN}\\.${RECEIPT_FILE_EXTENSION_PATTERN}$`,
    'i',
  );
