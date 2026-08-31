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
  unitId: string,
  entitledUnitIds: ReadonlySet<string>,
): boolean {
  if (accessLevel === 'preview') {
    return false;
  }

  return !entitledUnitIds.has(unitId);
}
