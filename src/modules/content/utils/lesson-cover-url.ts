import { Logger } from '@nestjs/common';
import type { R2StorageService } from '../../../lib/storage/r2-storage.service';
import { COVER_VIEW_URL_EXPIRES_SECONDS } from '../constants/content-upload.constants';

const logger = new Logger('LessonCoverUrl');

/** Signed GET URL for a lesson cover, or null if missing/unavailable. */
export async function createLessonCoverUrl(
  r2StorageService: R2StorageService,
  coverStorageKey: string | null | undefined,
): Promise<string | null> {
  if (!coverStorageKey) {
    return null;
  }

  try {
    return await r2StorageService.createSignedGetUrl({
      key: coverStorageKey,
      expiresInSeconds: COVER_VIEW_URL_EXPIRES_SECONDS,
    });
  } catch (error) {
    logger.error(
      `Failed to create signed cover URL for key ${coverStorageKey}`,
      error,
    );
    return null;
  }
}
