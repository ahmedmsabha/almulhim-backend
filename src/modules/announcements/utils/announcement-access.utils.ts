import type { StudentRegion } from '../../../generated/prisma/client';

export function buildAnnouncementVisibilityWhere(region: StudentRegion) {
  return {
    isPublished: true,
    OR: [{ region }, { region: 'both' as const }],
  };
}
