import type {
  LessonAccessLevel,
  StudentRegion,
} from '../../../generated/prisma/client';

export function buildUnitVisibilityWhere(region: StudentRegion) {
  return {
    isPublished: true,
    OR: [{ region }, { region: 'both' as const }],
  };
}

export function computeIsLocked(
  accessLevel: LessonAccessLevel,
  hasActiveSubscription: boolean,
): boolean {
  if (accessLevel === 'preview') {
    return false;
  }

  return !hasActiveSubscription;
}
