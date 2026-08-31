import type {
  SubscriptionPlan,
  User,
} from '../../../generated/prisma/client';

export type PlanUnitSummary = {
  id: string;
  title: string;
};

export type PublicPlanResponse = {
  id: string;
  name: string;
  description: string | null;
  priceGaza: number;
  priceWestBank: number;
  currency: string;
  accessEndsAt: string;
  startsAt: string | null;
  sortOrder: number;
  units: PlanUnitSummary[];
};

export type PublicPlanListResponse = {
  plans: PublicPlanResponse[];
};

export type PlanResponse = {
  id: string;
  name: string;
  description: string | null;
  priceAmount: number;
  currency: string;
  accessEndsAt: string;
  startsAt: string | null;
  sortOrder: number;
  units: PlanUnitSummary[];
};

export type PlanListResponse = {
  plans: PlanResponse[];
};

export type AdminPlanResponse = {
  id: string;
  name: string;
  description: string | null;
  priceGaza: number;
  priceWestBank: number;
  currency: string;
  accessEndsAt: string;
  startsAt: string | null;
  sortOrder: number;
  isActive: boolean;
  unitIds: string[];
  units: PlanUnitSummary[];
  createdAt: string;
  updatedAt: string;
};

export type AdminPlanListResponse = {
  plans: AdminPlanResponse[];
};

export type PlanWithUnits = SubscriptionPlan & {
  units: Array<{
    unitId: string;
    unit: { id: string; title: string; sortOrder: number };
  }>;
};

export const PLAN_WITH_UNITS_INCLUDE = {
  units: {
    include: {
      unit: {
        select: { id: true, title: true, sortOrder: true },
      },
    },
  },
} as const;

export const toPlanUnitSummaries = (plan: PlanWithUnits): PlanUnitSummary[] =>
  [...plan.units]
    .sort((left, right) => {
      const sortDiff = left.unit.sortOrder - right.unit.sortOrder;
      if (sortDiff !== 0) {
        return sortDiff;
      }
      return left.unit.title.localeCompare(right.unit.title);
    })
    .map((row) => ({ id: row.unit.id, title: row.unit.title }));

const toIso = (value: Date): string => value.toISOString();

export const resolveRegionPrice = (
  plan: Pick<SubscriptionPlan, 'priceGaza' | 'priceWestBank'>,
  region: User['region'],
): number => (region === 'west_bank' ? plan.priceWestBank : plan.priceGaza);

export const toPublicPlanResponse = (
  plan: PlanWithUnits,
): PublicPlanResponse => ({
  id: plan.id,
  name: plan.name,
  description: plan.description,
  priceGaza: plan.priceGaza,
  priceWestBank: plan.priceWestBank,
  currency: plan.currency,
  accessEndsAt: toIso(plan.accessEndsAt),
  startsAt: plan.startsAt ? toIso(plan.startsAt) : null,
  sortOrder: plan.sortOrder,
  units: toPlanUnitSummaries(plan),
});

export const toPlanResponse = (
  plan: PlanWithUnits,
  region: User['region'],
): PlanResponse => ({
  id: plan.id,
  name: plan.name,
  description: plan.description,
  priceAmount: resolveRegionPrice(plan, region),
  currency: plan.currency,
  accessEndsAt: toIso(plan.accessEndsAt),
  startsAt: plan.startsAt ? toIso(plan.startsAt) : null,
  sortOrder: plan.sortOrder,
  units: toPlanUnitSummaries(plan),
});

export const toAdminPlanResponse = (
  plan: PlanWithUnits,
): AdminPlanResponse => ({
  id: plan.id,
  name: plan.name,
  description: plan.description,
  priceGaza: plan.priceGaza,
  priceWestBank: plan.priceWestBank,
  currency: plan.currency,
  accessEndsAt: toIso(plan.accessEndsAt),
  startsAt: plan.startsAt ? toIso(plan.startsAt) : null,
  sortOrder: plan.sortOrder,
  isActive: plan.isActive,
  unitIds: plan.units.map((row) => row.unitId),
  units: toPlanUnitSummaries(plan),
  createdAt: toIso(plan.createdAt),
  updatedAt: toIso(plan.updatedAt),
});
