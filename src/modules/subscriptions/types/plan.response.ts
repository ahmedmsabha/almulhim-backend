import type { SubscriptionPlan } from '../../../generated/prisma/client';

export type PublicPlanResponse = {
  name: string;
  priceAmount: number;
  currency: string;
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
  durationDays: number;
  sortOrder: number;
};

export type PlanListResponse = {
  plans: PlanResponse[];
};

export type AdminPlanResponse = PlanResponse & {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminPlanListResponse = {
  plans: AdminPlanResponse[];
};

export const toPublicPlanResponse = (
  plan: SubscriptionPlan,
): PublicPlanResponse => ({
  name: plan.name,
  priceAmount: plan.priceAmount,
  currency: plan.currency,
});

export const toPlanResponse = (plan: SubscriptionPlan): PlanResponse => ({
  id: plan.id,
  name: plan.name,
  description: plan.description,
  priceAmount: plan.priceAmount,
  currency: plan.currency,
  durationDays: plan.durationDays,
  sortOrder: plan.sortOrder,
});

export const toAdminPlanResponse = (
  plan: SubscriptionPlan,
): AdminPlanResponse => ({
  ...toPlanResponse(plan),
  isActive: plan.isActive,
  createdAt: plan.createdAt.toISOString(),
  updatedAt: plan.updatedAt.toISOString(),
});
