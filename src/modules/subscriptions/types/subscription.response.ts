import type {
  Subscription,
  SubscriptionPlan,
} from '../../../generated/prisma/client';
import type { StudentSubscriptionStatus } from '../../users/schemas/list-students-query.schema';
import { deriveStudentSubscriptionStatus } from '../../users/types/user-profile.response';

export type SubscriptionPlanSummary = {
  id: string;
  name: string;
  priceGaza: number;
  priceWestBank: number;
  currency: string;
};

export type SubscriptionResponse = {
  id: string;
  status: Subscription['status'];
  plan: SubscriptionPlanSummary;
  receiptSenderName: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MySubscriptionsResponse = {
  subscriptions: SubscriptionResponse[];
  overallStatus: StudentSubscriptionStatus;
  entitledUnitIds: string[];
};

export type ReceiptUploadUrlResponse = {
  uploadUrl: string;
  receiptStorageKey: string;
  expiresInSeconds: number;
};

type SubscriptionWithPlan = Subscription & {
  plan: SubscriptionPlan;
};

export const toSubscriptionPlanSummary = (
  plan: SubscriptionPlan,
): SubscriptionPlanSummary => ({
  id: plan.id,
  name: plan.name,
  priceGaza: plan.priceGaza,
  priceWestBank: plan.priceWestBank,
  currency: plan.currency,
});

export const toSubscriptionResponse = (
  subscription: SubscriptionWithPlan,
): SubscriptionResponse => ({
  id: subscription.id,
  status: subscription.status,
  plan: toSubscriptionPlanSummary(subscription.plan),
  receiptSenderName: subscription.receiptSenderName,
  expiresAt: subscription.expiresAt?.toISOString() ?? null,
  createdAt: subscription.createdAt.toISOString(),
  updatedAt: subscription.updatedAt.toISOString(),
});

export const toMySubscriptionsResponse = (
  subscriptions: SubscriptionWithPlan[],
  entitledUnitIds: string[],
): MySubscriptionsResponse => ({
  subscriptions: subscriptions.map(toSubscriptionResponse),
  overallStatus: deriveStudentSubscriptionStatus(subscriptions),
  entitledUnitIds,
});
