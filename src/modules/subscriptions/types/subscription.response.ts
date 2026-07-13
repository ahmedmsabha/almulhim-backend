import type {
  Subscription,
  SubscriptionPlan,
} from '../../../generated/prisma/client';

export type SubscriptionPlanSummary = {
  id: string;
  name: string;
  priceAmount: number;
  currency: string;
  durationDays: number;
};

export type SubscriptionResponse = {
  id: string;
  status: Subscription['status'];
  plan: SubscriptionPlanSummary;
  receiptSenderName: string | null;
  createdAt: string;
  updatedAt: string;
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
  priceAmount: plan.priceAmount,
  currency: plan.currency,
  durationDays: plan.durationDays,
});

export const toSubscriptionResponse = (
  subscription: SubscriptionWithPlan,
): SubscriptionResponse => ({
  id: subscription.id,
  status: subscription.status,
  plan: toSubscriptionPlanSummary(subscription.plan),
  receiptSenderName: subscription.receiptSenderName,
  createdAt: subscription.createdAt.toISOString(),
  updatedAt: subscription.updatedAt.toISOString(),
});
