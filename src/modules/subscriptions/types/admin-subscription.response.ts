import type {
  Subscription,
  SubscriptionPlan,
  User,
} from '../../../generated/prisma/client';
import { type SubscriptionPlanSummary, toSubscriptionPlanSummary } from './subscription.response';

export type AdminStudentSummary = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  region: string;
};

/**
 * Admin subscription DTO used by GET /subscriptions/pending,
 * GET /subscriptions/archived, and GET /subscriptions/:id.
 *
 * `verificationResult` is the JSON blob written by `ReceiptVerificationService`
 * (`ReceiptVerificationResult` when `version === 1`, otherwise `null` before verify).
 * See that type and the Backend README for field names and an example payload.
 * This response never includes receipt binary or a permanent R2 URL.
 */
export type AdminSubscriptionResponse = {
  id: string;
  status: Subscription['status'];
  plan: SubscriptionPlanSummary;
  student: AdminStudentSummary;
  receiptSenderName: string | null;
  /** Stored AI/pipeline result; shape is `ReceiptVerificationResult` when version === 1. */
  verificationResult: unknown;
  verifiedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  expiresAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminSubscriptionListResponse = {
  subscriptions: AdminSubscriptionResponse[];
};

export type ReceiptUrlResponse = {
  url: string;
  expiresInSeconds: number;
};

type SubscriptionWithPlanAndUser = Subscription & {
  plan: SubscriptionPlan;
  user: User;
};

export const toAdminStudentSummary = (user: User): AdminStudentSummary => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  region: user.region,
});

export const toAdminSubscriptionResponse = (
  subscription: SubscriptionWithPlanAndUser,
): AdminSubscriptionResponse => ({
  id: subscription.id,
  status: subscription.status,
  plan: toSubscriptionPlanSummary(subscription.plan),
  student: toAdminStudentSummary(subscription.user),
  receiptSenderName: subscription.receiptSenderName,
  verificationResult: subscription.verificationResult,
  verifiedAt: subscription.verifiedAt?.toISOString() ?? null,
  approvedAt: subscription.approvedAt?.toISOString() ?? null,
  rejectedAt: subscription.rejectedAt?.toISOString() ?? null,
  rejectionReason: subscription.rejectionReason,
  expiresAt: subscription.expiresAt?.toISOString() ?? null,
  suspendedAt: subscription.suspendedAt?.toISOString() ?? null,
  createdAt: subscription.createdAt.toISOString(),
  updatedAt: subscription.updatedAt.toISOString(),
});
