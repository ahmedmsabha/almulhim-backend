import type { Subscription } from '../../../generated/prisma/client';
import type { AdminStudentSummary } from './admin-subscription.response';
import type { SubscriptionPlanSummary } from './subscription.response';
import {
  isReceiptVerificationResult,
  type ReceiptVerificationResult,
} from './receipt-verification-result.types';

/**
 * Admin AI verification log row derived from subscription `verificationResult`
 * / `verifiedAt` — not a separate audit table.
 */
export type AiVerificationLogItem = {
  subscriptionId: string;
  student: AdminStudentSummary;
  plan: SubscriptionPlanSummary;
  status: Subscription['status'];
  verificationResult: ReceiptVerificationResult | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiVerificationLogListResponse = {
  logs: AiVerificationLogItem[];
};

export const toAiVerificationLogItem = (params: {
  subscriptionId: string;
  student: AdminStudentSummary;
  plan: SubscriptionPlanSummary;
  status: Subscription['status'];
  verificationResult: unknown;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AiVerificationLogItem => ({
  subscriptionId: params.subscriptionId,
  student: params.student,
  plan: params.plan,
  status: params.status,
  verificationResult: isReceiptVerificationResult(params.verificationResult)
    ? params.verificationResult
    : null,
  verifiedAt: params.verifiedAt?.toISOString() ?? null,
  createdAt: params.createdAt.toISOString(),
  updatedAt: params.updatedAt.toISOString(),
});
