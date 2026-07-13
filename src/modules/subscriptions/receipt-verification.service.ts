import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { AiProviderService, RECEIPT_VERIFICATION_MODEL } from '../../lib/ai';
import { PrismaService } from '../../lib/database/prisma.service';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import { DUPLICATE_TRANSACTION_REFERENCE_REASON } from './constants/receipt-verification.constants';
import {
  extractTransactionReference,
  RECEIPT_VERIFICATION_RESULT_VERSION,
  type ReceiptVerificationResult,
} from './types/receipt-verification-result.types';
import {
  receiptValidationErrorMessage,
  validateReceiptObjectMetadata,
} from './utils/receipt-object.validation';
import { normalizeTransactionReference } from './utils/transaction-reference.util';

type SubscriptionForVerification = {
  id: string;
  status: string;
  receiptStorageKey: string | null;
  receiptSenderName: string | null;
  verificationResult: unknown;
  verifiedAt: Date | null;
};

const VERIFICATION_IN_FLIGHT_TIMEOUT_MS = 30 * 60 * 1000;

@Injectable()
export class ReceiptVerificationService {
  private readonly logger = new Logger(ReceiptVerificationService.name);
  private readonly inFlightVerifications = new Map<string, number>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
    private readonly aiProviderService: AiProviderService,
  ) {}

  isVerificationInFlight(subscriptionId: string): boolean {
    const startedAt = this.inFlightVerifications.get(subscriptionId);

    if (startedAt === undefined) {
      return false;
    }

    if (Date.now() - startedAt >= VERIFICATION_IN_FLIGHT_TIMEOUT_MS) {
      return false;
    }

    return true;
  }

  scheduleVerification(subscriptionId: string): void {
    void this.verifySubscription(subscriptionId).catch((error: unknown) => {
      this.logger.error(
        `Unhandled receipt verification failure for subscription ${subscriptionId}`,
        error,
      );
    });
  }

  private tryAcquireVerification(subscriptionId: string): boolean {
    const startedAt = this.inFlightVerifications.get(subscriptionId);
    const now = Date.now();

    if (
      startedAt !== undefined &&
      now - startedAt < VERIFICATION_IN_FLIGHT_TIMEOUT_MS
    ) {
      return false;
    }

    this.inFlightVerifications.set(subscriptionId, now);
    return true;
  }

  private releaseVerification(subscriptionId: string): void {
    this.inFlightVerifications.delete(subscriptionId);
  }

  async assertTransactionReferenceAvailable(
    subscriptionId: string,
    receiptTransactionReference: string | null,
    verificationResult: unknown,
  ): Promise<void> {
    const reference =
      receiptTransactionReference ??
      extractTransactionReference(verificationResult);
    const normalizedReference = normalizeTransactionReference(reference);

    if (!normalizedReference) {
      return;
    }

    const referenceTaken = await this.isTransactionReferenceTaken(
      subscriptionId,
      normalizedReference,
    );

    if (referenceTaken) {
      throw new ConflictException(
        'Receipt transaction reference is already in use',
      );
    }
  }

  async verifySubscription(subscriptionId: string): Promise<void> {
    if (!this.tryAcquireVerification(subscriptionId)) {
      this.logger.debug(
        `Skipping receipt verification for subscription ${subscriptionId} because one is already in flight`,
      );
      return;
    }

    try {
      const subscription = await this.loadSubscriptionForVerification(
        subscriptionId,
      );

      if (!subscription) {
        return;
      }

      if (subscription.status !== 'pending_review' || subscription.verifiedAt) {
        return;
      }

      if (!subscription.receiptStorageKey || !subscription.receiptSenderName) {
        await this.persistVerificationFailure(
          subscription.id,
          'Receipt metadata is incomplete',
        );
        return;
      }

      if (!this.aiProviderService.isReceiptAiEnabled()) {
        await this.persistSkippedVerification(subscription.id);
        return;
      }

      const receiptMetadata = await this.r2StorageService.headObject(
        subscription.receiptStorageKey,
      );
      const receiptValidation = validateReceiptObjectMetadata(receiptMetadata);

      if (!receiptValidation.valid) {
        await this.persistVerificationFailure(
          subscription.id,
          receiptValidationErrorMessage(receiptValidation.error),
        );
        return;
      }

      const receiptObject = await this.r2StorageService.getObject(
        subscription.receiptStorageKey,
      );

      if (!receiptObject) {
        await this.persistVerificationFailure(
          subscription.id,
          'Receipt file was not found in storage',
        );
        return;
      }

      const mediaType = receiptValidation.contentType;

      const knownTransactionReferences =
        await this.loadKnownTransactionReferences(subscription.id);

      const analysis = await this.aiProviderService.analyzeReceipt({
        imageBuffer: receiptObject.body,
        mediaType,
        expectedRecipientNames:
          this.aiProviderService.getExpectedRecipientNames(),
        expectedSenderName: subscription.receiptSenderName,
        knownTransactionReferences,
      });

      const duplicateReferenceInUse = this.isDuplicateTransactionReference(
        analysis.transactionReference,
        knownTransactionReferences,
      );

      const verificationResult = this.buildVerificationResult({
        analysis,
        expectedSenderName: subscription.receiptSenderName,
        duplicateReferenceInUse,
      });

      await this.persistVerificationOutcome(subscription.id, verificationResult);
    } catch (error) {
      this.logger.error(
        `Receipt verification failed for subscription ${subscriptionId}`,
        error,
      );

      await this.persistVerificationFailure(
        subscriptionId,
        error instanceof Error ? error.message : 'Receipt verification failed',
      );
    } finally {
      this.releaseVerification(subscriptionId);
    }
  }

  private async loadSubscriptionForVerification(
    subscriptionId: string,
  ): Promise<SubscriptionForVerification | null> {
    try {
      return await this.prismaService.subscription.findUnique({
        where: { id: subscriptionId },
        select: {
          id: true,
          status: true,
          receiptStorageKey: true,
          receiptSenderName: true,
          verificationResult: true,
          verifiedAt: true,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to load subscription ${subscriptionId} for verification`,
        error,
      );
      throw error;
    }
  }

  private async loadKnownTransactionReferences(
    subscriptionId: string,
  ): Promise<string[]> {
    try {
      const subscriptions = await this.prismaService.subscription.findMany({
        where: {
          id: { not: subscriptionId },
          status: { not: 'rejected' },
        },
        select: {
          receiptTransactionReference: true,
          verificationResult: true,
        },
      });

      const references = new Set<string>();

      for (const subscription of subscriptions) {
        const columnReference = normalizeTransactionReference(
          subscription.receiptTransactionReference,
        );

        if (columnReference) {
          references.add(columnReference);
        }

        const jsonReference = normalizeTransactionReference(
          extractTransactionReference(subscription.verificationResult),
        );

        if (jsonReference) {
          references.add(jsonReference);
        }
      }

      return [...references];
    } catch (error) {
      this.logger.error(
        `Failed to load known transaction references for subscription ${subscriptionId}`,
        error,
      );
      throw error;
    }
  }

  private async isTransactionReferenceTaken(
    subscriptionId: string,
    normalizedReference: string,
  ): Promise<boolean> {
    const knownReferences =
      await this.loadKnownTransactionReferences(subscriptionId);

    return knownReferences.includes(normalizedReference);
  }

  private buildVerificationResult(input: {
    analysis: {
      recipientNameDetected: string | null;
      recipientMatch: boolean;
      senderNameDetected: string | null;
      senderMatch: boolean;
      transactionReference: string | null;
      appearsDuplicate: boolean;
      duplicateReason: string | null;
      notes: string | null;
    };
    expectedSenderName: string;
    duplicateReferenceInUse: boolean;
  }): ReceiptVerificationResult {
    const notDuplicatePassed =
      !input.analysis.appearsDuplicate && !input.duplicateReferenceInUse;

    const notDuplicateReason = input.duplicateReferenceInUse
      ? DUPLICATE_TRANSACTION_REFERENCE_REASON
      : input.analysis.appearsDuplicate
        ? input.analysis.duplicateReason ??
          'Receipt appears to duplicate a previous payment'
        : null;

    const checks = {
      recipientMatch: {
        passed: input.analysis.recipientMatch,
        detected: input.analysis.recipientNameDetected,
        reason: input.analysis.recipientMatch
          ? null
          : 'Recipient name does not match expected teacher account',
      },
      senderMatch: {
        passed: input.analysis.senderMatch,
        detected: input.analysis.senderNameDetected,
        expected: input.expectedSenderName,
        reason: input.analysis.senderMatch
          ? null
          : 'Sender name does not match the name entered by the student',
      },
      notDuplicate: {
        passed: notDuplicatePassed,
        detected: input.analysis.transactionReference,
        transactionReference: input.analysis.transactionReference,
        reason: notDuplicatePassed ? null : notDuplicateReason,
      },
    };

    const passed =
      checks.recipientMatch.passed &&
      checks.senderMatch.passed &&
      checks.notDuplicate.passed;

    return {
      version: RECEIPT_VERIFICATION_RESULT_VERSION,
      passed,
      verifiedAt: new Date().toISOString(),
      aiEnabled: true,
      model: RECEIPT_VERIFICATION_MODEL,
      error: null,
      checks,
      notes: input.analysis.notes,
    };
  }

  private buildSkippedVerificationResult(): ReceiptVerificationResult {
    const verifiedAt = new Date().toISOString();

    return {
      version: RECEIPT_VERIFICATION_RESULT_VERSION,
      passed: true,
      verifiedAt,
      aiEnabled: false,
      model: null,
      error: null,
      checks: {
        recipientMatch: {
          passed: true,
          detected: null,
          reason: null,
        },
        senderMatch: {
          passed: true,
          detected: null,
          expected: null,
          reason: null,
        },
        notDuplicate: {
          passed: true,
          detected: null,
          transactionReference: null,
          reason: null,
        },
      },
      notes: 'Receipt AI verification skipped because RECEIPT_AI_ENABLED is false',
    };
  }

  private buildFailureVerificationResult(error: string): ReceiptVerificationResult {
    return {
      version: RECEIPT_VERIFICATION_RESULT_VERSION,
      passed: false,
      verifiedAt: new Date().toISOString(),
      aiEnabled: this.aiProviderService.isReceiptAiEnabled(),
      model: this.aiProviderService.isReceiptAiEnabled()
        ? RECEIPT_VERIFICATION_MODEL
        : null,
      error,
      checks: {
        recipientMatch: {
          passed: false,
          detected: null,
          reason: error,
        },
        senderMatch: {
          passed: false,
          detected: null,
          expected: null,
          reason: error,
        },
        notDuplicate: {
          passed: false,
          detected: null,
          transactionReference: null,
          reason: error,
        },
      },
      notes: null,
    };
  }

  private async persistSkippedVerification(subscriptionId: string): Promise<void> {
    await this.persistVerificationOutcome(
      subscriptionId,
      this.buildSkippedVerificationResult(),
    );
  }

  private async persistVerificationFailure(
    subscriptionId: string,
    error: string,
  ): Promise<void> {
    await this.persistVerificationOutcome(
      subscriptionId,
      this.buildFailureVerificationResult(error),
    );
  }

  private async persistVerificationOutcome(
    subscriptionId: string,
    verificationResult: ReceiptVerificationResult,
  ): Promise<void> {
    try {
      let outcome = verificationResult;
      const normalizedReference = this.normalizeTransactionReference(
        outcome.checks.notDuplicate.transactionReference,
      );

      if (normalizedReference) {
        const referenceTaken = await this.isTransactionReferenceTaken(
          subscriptionId,
          normalizedReference,
        );

        if (referenceTaken) {
          outcome = this.markVerificationResultAsDuplicate(outcome);
        }
      }

      const claimed = await this.claimVerificationOutcome(
        subscriptionId,
        outcome,
        normalizedReference,
      );

      if (claimed) {
        return;
      }
    } catch (error) {
      this.logger.error(
        `Failed to persist verification outcome for subscription ${subscriptionId}`,
        error,
      );
      throw error;
    }
  }

  private buildVerificationOutcomeData(
    verificationResult: ReceiptVerificationResult,
    normalizedReference: string | null,
  ) {
    const shouldClaimReference =
      verificationResult.passed && normalizedReference !== null;

    return {
      verificationResult,
      verifiedAt: new Date(verificationResult.verifiedAt),
      status: verificationResult.passed
        ? ('pending_approval' as const)
        : ('pending_review' as const),
      receiptTransactionReference: shouldClaimReference
        ? normalizedReference
        : null,
    };
  }

  private async claimVerificationOutcome(
    subscriptionId: string,
    verificationResult: ReceiptVerificationResult,
    normalizedReference: string | null,
  ): Promise<boolean> {
    const shouldClaimReference =
      verificationResult.passed && normalizedReference !== null;
    const data = this.buildVerificationOutcomeData(
      verificationResult,
      normalizedReference,
    );

    try {
      const result = await this.prismaService.subscription.updateMany({
        where: {
          id: subscriptionId,
          status: 'pending_review',
          verifiedAt: null,
        },
        data,
      });

      return result.count > 0;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        this.isReceiptTransactionReferenceConstraintViolation(error) &&
        shouldClaimReference
      ) {
        const duplicateOutcome =
          this.markVerificationResultAsDuplicate(verificationResult);

        return this.claimVerificationOutcome(
          subscriptionId,
          duplicateOutcome,
          null,
        );
      }

      throw error;
    }
  }

  private markVerificationResultAsDuplicate(
    verificationResult: ReceiptVerificationResult,
  ): ReceiptVerificationResult {
    return {
      ...verificationResult,
      passed: false,
      checks: {
        ...verificationResult.checks,
        notDuplicate: {
          ...verificationResult.checks.notDuplicate,
          passed: false,
          reason: DUPLICATE_TRANSACTION_REFERENCE_REASON,
        },
      },
    };
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

  private normalizeTransactionReference(
    transactionReference: string | null,
  ): string | null {
    return normalizeTransactionReference(transactionReference);
  }

  private isDuplicateTransactionReference(
    transactionReference: string | null,
    knownTransactionReferences: string[],
  ): boolean {
    const normalizedReference =
      this.normalizeTransactionReference(transactionReference);

    if (!normalizedReference) {
      return false;
    }

    return knownTransactionReferences.includes(normalizedReference);
  }
}
