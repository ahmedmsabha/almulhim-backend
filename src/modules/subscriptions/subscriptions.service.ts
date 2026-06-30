import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { ZodError } from 'zod';
import { PostHogService } from '../../lib/posthog/posthog.service';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import { PrismaService } from '../../lib/database/prisma.service';
import {
  ALLOWED_RECEIPT_CONTENT_TYPES,
  buildReceiptStorageKeyPattern,
  MAX_RECEIPT_SIZE_BYTES,
  OPEN_SUBSCRIPTION_STATUSES,
  RECEIPT_CONTENT_TYPE_EXTENSION,
  RECEIPT_KEY_PREFIX,
  RECEIPT_UPLOAD_EXPIRES_SECONDS,
  type AllowedReceiptContentType,
} from './constants/receipt-upload.constants';
import {
  createReceiptUploadUrlSchema,
  type CreateReceiptUploadUrlInput,
} from './schemas/create-receipt-upload-url.schema';
import {
  submitSubscriptionSchema,
  type SubmitSubscriptionInput,
} from './schemas/submit-subscription.schema';
import {
  toSubscriptionResponse,
  type ReceiptUploadUrlResponse,
  type SubscriptionResponse,
} from './types/subscription.response';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly r2StorageService: R2StorageService,
    private readonly postHogService: PostHogService,
  ) {}

  async createReceiptUploadUrl(
    clerkId: string,
    input: unknown,
  ): Promise<ReceiptUploadUrlResponse> {
    const user = await this.requireRegisteredUser(clerkId);
    await this.assertNoOpenSubscription(user.id);
    const validatedInput = this.parseReceiptUploadUrlInput(input);
    const receiptStorageKey = this.buildReceiptStorageKey(
      user.id,
      validatedInput.contentType,
    );

    try {
      const uploadUrl = await this.r2StorageService.createSignedPutUrl({
        key: receiptStorageKey,
        contentType: validatedInput.contentType,
        expiresInSeconds: RECEIPT_UPLOAD_EXPIRES_SECONDS,
      });

      return {
        uploadUrl,
        receiptStorageKey,
        expiresInSeconds: RECEIPT_UPLOAD_EXPIRES_SECONDS,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create receipt upload URL for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async submitSubscription(
    clerkId: string,
    input: unknown,
  ): Promise<SubscriptionResponse> {
    const user = await this.requireRegisteredUser(clerkId);
    const validatedInput = this.parseSubmitSubscriptionInput(input);

    await this.assertNoOpenSubscription(user.id);
    await this.assertActivePlan(validatedInput.planId);
    this.assertReceiptKeyOwnership(user.id, validatedInput.receiptStorageKey);
    await this.assertReceiptKeyNotUsed(validatedInput.receiptStorageKey);
    await this.assertValidReceiptObject(validatedInput.receiptStorageKey);

    try {
      const subscription = await this.prismaService.subscription.create({
        data: {
          userId: user.id,
          planId: validatedInput.planId,
          status: 'pending_review',
          receiptStorageKey: validatedInput.receiptStorageKey,
          receiptSenderName: validatedInput.senderName,
        },
        include: { plan: true },
      });

      this.postHogService.capture(user.id, 'subscription_submitted', {
        subscriptionId: subscription.id,
        planId: subscription.planId,
        status: subscription.status,
      });

      return toSubscriptionResponse(subscription);
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.mapSubscriptionUniqueConstraintError(error);
      }

      this.logger.error(
        `Failed to submit subscription for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async getMySubscription(clerkId: string): Promise<SubscriptionResponse> {
    const user = await this.requireRegisteredUser(clerkId);

    try {
      const subscription = await this.prismaService.subscription.findFirst({
        where: {
          userId: user.id,
          status: { in: OPEN_SUBSCRIPTION_STATUSES },
        },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!subscription) {
        throw new NotFoundException('No open subscription found');
      }

      return toSubscriptionResponse(subscription);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to load open subscription for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  private async requireRegisteredUser(clerkId: string) {
    try {
      const user = await this.prismaService.user.findUnique({
        where: { clerkId },
      });

      if (!user) {
        throw new ForbiddenException('User is not registered');
      }

      return user;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(
        `Failed to resolve registered user for clerkId ${clerkId}`,
        error,
      );
      throw error;
    }
  }

  private parseReceiptUploadUrlInput(
    input: unknown,
  ): CreateReceiptUploadUrlInput {
    try {
      return createReceiptUploadUrlSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      this.logger.error('Failed to validate receipt upload URL payload', error);
      throw error;
    }
  }

  private parseSubmitSubscriptionInput(
    input: unknown,
  ): SubmitSubscriptionInput {
    try {
      return submitSubscriptionSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      this.logger.error('Failed to validate submit subscription payload', error);
      throw error;
    }
  }

  private buildReceiptStorageKey(
    userId: string,
    contentType: AllowedReceiptContentType,
  ): string {
    const extension = RECEIPT_CONTENT_TYPE_EXTENSION[contentType];
    return `${RECEIPT_KEY_PREFIX}/${userId}/${randomUUID()}.${extension}`;
  }

  private assertReceiptKeyOwnership(userId: string, receiptStorageKey: string) {
    const keyPattern = buildReceiptStorageKeyPattern(userId);

    if (!keyPattern.test(receiptStorageKey)) {
      throw new BadRequestException('Invalid receipt storage key');
    }
  }

  private async assertReceiptKeyNotUsed(receiptStorageKey: string): Promise<void> {
    try {
      const existingSubscription =
        await this.prismaService.subscription.findFirst({
          where: { receiptStorageKey },
          select: { id: true },
        });

      if (existingSubscription) {
        throw new ConflictException(
          'Receipt has already been used for a subscription',
        );
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      this.logger.error(
        `Failed to check receipt key reuse for ${receiptStorageKey}`,
        error,
      );
      throw error;
    }
  }

  private mapSubscriptionUniqueConstraintError(
    error: PrismaClientKnownRequestError,
  ): ConflictException {
    const target = error.meta?.target;

    if (Array.isArray(target) && target.includes('receipt_storage_key')) {
      return new ConflictException(
        'Receipt has already been used for a subscription',
      );
    }

    return new ConflictException('User already has an open subscription');
  }

  private async assertNoOpenSubscription(userId: string): Promise<void> {
    try {
      const existingSubscription =
        await this.prismaService.subscription.findFirst({
          where: {
            userId,
            status: { in: OPEN_SUBSCRIPTION_STATUSES },
          },
          select: { id: true },
        });

      if (existingSubscription) {
        throw new ConflictException('User already has an open subscription');
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      this.logger.error(
        `Failed to check open subscription for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  private async assertActivePlan(planId: string): Promise<void> {
    try {
      const plan = await this.prismaService.subscriptionPlan.findUnique({
        where: { id: planId },
        select: { id: true, isActive: true },
      });

      if (!plan) {
        throw new NotFoundException('Plan not found');
      }

      if (!plan.isActive) {
        throw new BadRequestException('Plan is not available');
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(`Failed to validate plan ${planId}`, error);
      throw error;
    }
  }

  private async assertValidReceiptObject(receiptStorageKey: string): Promise<void> {
    try {
      const metadata =
        await this.r2StorageService.headObject(receiptStorageKey);

      if (!metadata) {
        throw new BadRequestException('Receipt file was not uploaded');
      }

      const contentType = metadata.contentType
        ?.split(';')[0]
        ?.trim()
        .toLowerCase();

      if (
        !contentType ||
        !(ALLOWED_RECEIPT_CONTENT_TYPES as readonly string[]).includes(
          contentType,
        )
      ) {
        throw new BadRequestException('Receipt file type is not allowed');
      }

      if (
        metadata.contentLength === undefined ||
        metadata.contentLength < 1
      ) {
        throw new BadRequestException('Receipt file was not uploaded');
      }

      if (metadata.contentLength > MAX_RECEIPT_SIZE_BYTES) {
        throw new BadRequestException('Receipt file exceeds maximum size');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to validate receipt object for key ${receiptStorageKey}`,
        error,
      );
      throw error;
    }
  }
}
