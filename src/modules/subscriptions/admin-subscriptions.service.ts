import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { ZodError } from 'zod';
import { AnalyticsService } from '../../lib/analytics/analytics.service';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import { PrismaService } from '../../lib/database/prisma.service';
import {
  rejectSubscriptionSchema,
  type RejectSubscriptionInput,
} from './schemas/reject-subscription.schema';
import {
  toAdminSubscriptionResponse,
  toAdminStudentSummary,
  type AdminSubscriptionListResponse,
  type AdminSubscriptionResponse,
  type ReceiptUrlResponse,
} from './types/admin-subscription.response';
import {
  toAiVerificationLogItem,
  type AiVerificationLogListResponse,
} from './types/ai-verification-log.response';
import { ReceiptVerificationService } from './receipt-verification.service';
import { extractTransactionReference } from './types/receipt-verification-result.types';
import { normalizeTransactionReference } from './utils/transaction-reference.util';
import { toSubscriptionPlanSummary } from './types/subscription.response';

const PENDING_STATUSES = ['pending_review', 'pending_approval'] as const;
const ARCHIVED_STATUSES = [
  'active',
  'rejected',
  'suspended',
  'expired',
] as const;
const REJECTABLE_STATUSES = [
  'pending_review',
  'pending_approval',
  'suspended',
] as const;
const RECEIPT_VIEW_URL_EXPIRES_SECONDS = 15 * 60;

@Injectable()
export class AdminSubscriptionsService {
  private readonly logger = new Logger(AdminSubscriptionsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
    private readonly analyticsService: AnalyticsService,
    private readonly receiptVerificationService: ReceiptVerificationService,
  ) {}

  async listPending(): Promise<AdminSubscriptionListResponse> {
    try {
      const subscriptions = await this.prismaService.subscription.findMany({
        where: { status: { in: [...PENDING_STATUSES] } },
        include: { plan: true, user: true },
        orderBy: { createdAt: 'asc' },
      });

      return {
        subscriptions: subscriptions.map(toAdminSubscriptionResponse),
      };
    } catch (error) {
      this.logger.error('Failed to list pending subscriptions', error);
      throw error;
    }
  }

  /**
   * Decided (non-pending) subscriptions for Admin "Archived Decisions".
   * Sort key: `updatedAt` desc (covers approve / reject / suspend / expire mutations).
   */
  async listArchived(): Promise<AdminSubscriptionListResponse> {
    try {
      const subscriptions = await this.prismaService.subscription.findMany({
        where: { status: { in: [...ARCHIVED_STATUSES] } },
        include: { plan: true, user: true },
        orderBy: { updatedAt: 'desc' },
      });

      return {
        subscriptions: subscriptions.map(toAdminSubscriptionResponse),
      };
    } catch (error) {
      this.logger.error('Failed to list archived subscriptions', error);
      throw error;
    }
  }

  /**
   * Receipt AI verification runs for Admin "AI Logs".
   * Includes rows where verification ran (`verifiedAt` set). The receipt pipeline
   * always writes `verificationResult` together with `verifiedAt` (including
   * failed AI payloads with `error` set).
   * Sort: `verifiedAt` desc nulls last, then `updatedAt` desc.
   */
  async listAiLogs(): Promise<AiVerificationLogListResponse> {
    try {
      const subscriptions = await this.prismaService.subscription.findMany({
        where: {
          verifiedAt: { not: null },
        },
        include: { plan: true, user: true },
        orderBy: [{ verifiedAt: 'desc' }, { updatedAt: 'desc' }],
      });

      return {
        logs: subscriptions.map((subscription) =>
          toAiVerificationLogItem({
            subscriptionId: subscription.id,
            student: toAdminStudentSummary(subscription.user),
            plan: toSubscriptionPlanSummary(subscription.plan),
            status: subscription.status,
            verificationResult: subscription.verificationResult,
            verifiedAt: subscription.verifiedAt,
            createdAt: subscription.createdAt,
            updatedAt: subscription.updatedAt,
          }),
        ),
      };
    } catch (error) {
      this.logger.error('Failed to list AI verification logs', error);
      throw error;
    }
  }

  async getSubscriptionById(
    subscriptionId: string,
  ): Promise<AdminSubscriptionResponse> {
    const subscription = await this.requireSubscription(subscriptionId);
    return toAdminSubscriptionResponse(subscription);
  }

  async getReceiptUrl(subscriptionId: string): Promise<ReceiptUrlResponse> {
    const subscription = await this.requireSubscription(subscriptionId);

    if (!subscription.receiptStorageKey) {
      throw new BadRequestException('Subscription has no receipt on file');
    }

    try {
      const url = await this.r2StorageService.createSignedGetUrl({
        key: subscription.receiptStorageKey,
        expiresInSeconds: RECEIPT_VIEW_URL_EXPIRES_SECONDS,
      });

      return { url, expiresInSeconds: RECEIPT_VIEW_URL_EXPIRES_SECONDS };
    } catch (error) {
      this.logger.error(
        `Failed to generate receipt URL for subscription ${subscriptionId}`,
        error,
      );
      throw error;
    }
  }

  async approveSubscription(
    subscriptionId: string,
    adminClerkId: string,
  ): Promise<AdminSubscriptionResponse> {
    const subscription = await this.requireSubscription(subscriptionId);

    if (!(PENDING_STATUSES as readonly string[]).includes(subscription.status)) {
      throw new BadRequestException(
        `Subscription cannot be approved from status '${subscription.status}'`,
      );
    }

    await this.receiptVerificationService.assertTransactionReferenceAvailable(
      subscriptionId,
      subscription.receiptTransactionReference,
      subscription.verificationResult,
    );

    const approvedAt = new Date();
    const expiresAt = new Date(
      approvedAt.getTime() +
        subscription.plan.durationDays * 24 * 60 * 60 * 1000,
    );
    const normalizedReference = normalizeTransactionReference(
      subscription.receiptTransactionReference ??
        extractTransactionReference(subscription.verificationResult),
    );
    const shouldClaimReference =
      normalizedReference !== null &&
      subscription.receiptTransactionReference === null;

    try {
      const approvalResult = await this.prismaService.subscription.updateMany({
        where: {
          id: subscriptionId,
          status: { in: [...PENDING_STATUSES] },
        },
        data: {
          status: 'active',
          approvedAt,
          expiresAt,
          ...(shouldClaimReference
            ? { receiptTransactionReference: normalizedReference }
            : {}),
        },
      });

      if (approvalResult.count === 0) {
        throw new BadRequestException(
          `Subscription cannot be approved from status '${subscription.status}'`,
        );
      }

      const updated = await this.prismaService.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true, user: true },
      });

      if (!updated) {
        throw new NotFoundException('Subscription not found');
      }

      this.analyticsService.captureSubscriptionApproved(updated.userId, {
        subscriptionId: updated.id,
        userId: updated.userId,
        adminClerkId,
      });

      return toAdminSubscriptionResponse(updated);
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        this.isReceiptTransactionReferenceConstraintViolation(error)
      ) {
        throw new ConflictException(
          'Receipt transaction reference is already in use',
        );
      }

      this.logger.error(
        `Failed to approve subscription ${subscriptionId}`,
        error,
      );
      throw error;
    }
  }

  private isReceiptTransactionReferenceConstraintViolation(
    error: PrismaClientKnownRequestError,
  ): boolean {
    const target = error.meta?.target;

    return (
      Array.isArray(target) &&
      target.includes('receipt_transaction_reference')
    );
  }

  async rejectSubscription(
    subscriptionId: string,
    adminClerkId: string,
    input: unknown,
  ): Promise<AdminSubscriptionResponse> {
    const validatedInput = this.parseRejectInput(input);
    const subscription = await this.requireSubscription(subscriptionId);

    if (!(REJECTABLE_STATUSES as readonly string[]).includes(subscription.status)) {
      throw new BadRequestException(
        `Subscription cannot be rejected from status '${subscription.status}'`,
      );
    }

    try {
      const rejectionResult = await this.prismaService.subscription.updateMany({
        where: {
          id: subscriptionId,
          status: { in: [...REJECTABLE_STATUSES] },
        },
        data: {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectionReason: validatedInput.rejectionReason ?? null,
          receiptTransactionReference: null,
        },
      });

      if (rejectionResult.count === 0) {
        throw new BadRequestException(
          `Subscription cannot be rejected from status '${subscription.status}'`,
        );
      }

      const updated = await this.prismaService.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true, user: true },
      });

      if (!updated) {
        throw new NotFoundException('Subscription not found');
      }

      this.analyticsService.captureSubscriptionRejected(updated.userId, {
        subscriptionId: updated.id,
        userId: updated.userId,
        adminClerkId,
      });

      return toAdminSubscriptionResponse(updated);
    } catch (error) {
      this.logger.error(
        `Failed to reject subscription ${subscriptionId}`,
        error,
      );
      throw error;
    }
  }

  async suspendSubscription(
    subscriptionId: string,
    adminClerkId: string,
  ): Promise<AdminSubscriptionResponse> {
    const subscription = await this.requireSubscription(subscriptionId);

    if (subscription.status !== 'active') {
      throw new BadRequestException(
        `Subscription cannot be suspended from status '${subscription.status}'`,
      );
    }

    try {
      const updated = await this.prismaService.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'suspended', suspendedAt: new Date() },
        include: { plan: true, user: true },
      });

      this.analyticsService.captureSubscriptionSuspended(updated.userId, {
        subscriptionId: updated.id,
        userId: updated.userId,
        adminClerkId,
      });

      return toAdminSubscriptionResponse(updated);
    } catch (error) {
      this.logger.error(
        `Failed to suspend subscription ${subscriptionId}`,
        error,
      );
      throw error;
    }
  }

  async expireStaleSubscriptions(): Promise<void> {
    const expirableStatuses = ['active', 'suspended'] as const;
    const batchSize = 50;

    try {
      const now = new Date();
      let expiredCount = 0;

      while (true) {
        const candidates = await this.prismaService.subscription.findMany({
          where: {
            status: { in: [...expirableStatuses] },
            expiresAt: { lte: now },
          },
          select: {
            id: true,
            userId: true,
            planId: true,
          },
          take: batchSize,
        });

        if (candidates.length === 0) {
          break;
        }

        for (const candidate of candidates) {
          const transitionResult =
            await this.prismaService.subscription.updateMany({
              where: {
                id: candidate.id,
                status: { in: [...expirableStatuses] },
                expiresAt: { lte: now },
              },
              data: { status: 'expired' },
            });

          if (transitionResult.count !== 1) {
            continue;
          }

          this.analyticsService.captureSubscriptionExpired(candidate.userId, {
            subscriptionId: candidate.id,
            planId: candidate.planId,
          });
          expiredCount += 1;
        }
      }

      if (expiredCount > 0) {
        this.logger.log(`Expired ${expiredCount} stale subscription(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to expire stale subscriptions', error);
      throw error;
    }
  }

  private async requireSubscription(subscriptionId: string) {
    try {
      const subscription = await this.prismaService.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true, user: true },
      });

      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      return subscription;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to load subscription ${subscriptionId}`,
        error,
      );
      throw error;
    }
  }

  private parseRejectInput(input: unknown): RejectSubscriptionInput {
    try {
      return rejectSubscriptionSchema.parse(input ?? {});
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      this.logger.error('Failed to validate reject subscription payload', error);
      throw error;
    }
  }
}
