jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    user = {
      findUnique: jest.fn(),
    };

    subscriptionPlan = {
      findUnique: jest.fn(),
    };

    subscription = {
      findFirst: jest.fn(),
      create: jest.fn(),
    };
  },
}));

jest.mock('../../lib/storage/r2-storage.service', () => ({
  R2StorageService: class MockR2StorageService {
    createSignedPutUrl = jest.fn();
    headObject = jest.fn();
  },
}));

jest.mock('./receipt-verification.service', () => ({
  ReceiptVerificationService: class MockReceiptVerificationService {
    scheduleVerification = jest.fn();
  },
}));

jest.mock('../../lib/analytics/analytics.service', () => ({
  AnalyticsService: class MockAnalyticsService {
    captureSubscriptionSubmitted = jest.fn();
  },
}));

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { AnalyticsService } from '../../lib/analytics/analytics.service';
import { PrismaService } from '../../lib/database/prisma.service';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import { ReceiptVerificationService } from './receipt-verification.service';
import { RECEIPT_UPLOAD_EXPIRES_SECONDS } from './constants/receipt-upload.constants';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let subscriptionsService: SubscriptionsService;
  let prismaService: PrismaService;
  let r2StorageService: R2StorageService;
  let analyticsService: AnalyticsService;
  let receiptVerificationService: ReceiptVerificationService;

  const studentUser = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clerkId: 'user_123',
    email: 'student@example.com',
    fullName: 'Student Name',
    phoneNumber: '0599000000',
    telegramUsername: 'student_tg',
    region: 'gaza' as const,
    role: 'student' as const,
    createdAt: new Date('2026-06-30T10:00:00.000Z'),
    updatedAt: new Date('2026-06-30T10:00:00.000Z'),
  };

  const activePlan = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Monthly',
    description: 'One month access',
    priceAmount: 9900,
    currency: 'ILS',
    durationDays: 30,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date('2026-06-30T10:00:00.000Z'),
    updatedAt: new Date('2026-06-30T10:00:00.000Z'),
  };

  const receiptStorageKey = `receipts/${studentUser.id}/550e8400-e29b-41d4-a716-446655440005.jpg`;

  const subscriptionRow = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    userId: studentUser.id,
    planId: activePlan.id,
    status: 'pending_review' as const,
    receiptStorageKey,
    receiptSenderName: 'Sender Name',
    verificationResult: null,
    verifiedAt: null,
    approvedAt: null,
    rejectedAt: null,
    expiresAt: null,
    suspendedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-06-30T11:00:00.000Z'),
    updatedAt: new Date('2026-06-30T11:00:00.000Z'),
    plan: activePlan,
  };

  const mockNoOpenSubscriptionOrReceiptReuse = () => {
    jest
      .spyOn(prismaService.subscription, 'findFirst')
      .mockImplementation(async (args) => {
        if (
          args &&
          typeof args === 'object' &&
          'where' in args &&
          args.where &&
          typeof args.where === 'object' &&
          'receiptStorageKey' in args.where
        ) {
          return null;
        }

        if (
          args &&
          typeof args === 'object' &&
          'where' in args &&
          args.where &&
          typeof args.where === 'object' &&
          'userId' in args.where
        ) {
          return null;
        }

        return null;
      });
  };

  beforeEach(() => {
    prismaService = new PrismaService({} as never);
    r2StorageService = new R2StorageService({} as never);
    analyticsService = new AnalyticsService({} as never);
    receiptVerificationService = new ReceiptVerificationService();
    subscriptionsService = new SubscriptionsService(
      prismaService,
      r2StorageService,
      analyticsService,
      receiptVerificationService,
    );
  });

  describe('createReceiptUploadUrl', () => {
    it('returns a presigned upload URL and server-generated key', async () => {
      mockNoOpenSubscriptionOrReceiptReuse();
      jest
        .spyOn(r2StorageService, 'createSignedPutUrl')
        .mockResolvedValue('https://upload.example.com');

      const result = await subscriptionsService.createReceiptUploadUrl(
        studentUser,
        { contentType: 'image/jpeg' },
      );

      expect(result.uploadUrl).toBe('https://upload.example.com');
      expect(result.receiptStorageKey).toMatch(
        new RegExp(
          `^receipts/${studentUser.id}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.jpg$`,
          'i',
        ),
      );
      expect(result.expiresInSeconds).toBe(RECEIPT_UPLOAD_EXPIRES_SECONDS);
      expect(r2StorageService.createSignedPutUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: 'image/jpeg',
          expiresInSeconds: RECEIPT_UPLOAD_EXPIRES_SECONDS,
        }),
      );
    });

    it('throws ConflictException when user already has an open subscription', async () => {
      jest.spyOn(prismaService.subscription, 'findFirst').mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440004',
      });

      await expect(
        subscriptionsService.createReceiptUploadUrl(studentUser, {
          contentType: 'image/jpeg',
        }),
      ).rejects.toThrow(
        new ConflictException('User already has an open subscription'),
      );
    });
  });

  describe('submitSubscription', () => {
    const submitInput = {
      planId: activePlan.id,
      senderName: 'Sender Name',
      receiptStorageKey,
    };

    beforeEach(() => {
      mockNoOpenSubscriptionOrReceiptReuse();
      jest
        .spyOn(prismaService.subscriptionPlan, 'findUnique')
        .mockResolvedValue({
          id: activePlan.id,
          isActive: true,
        });
      jest.spyOn(r2StorageService, 'headObject').mockResolvedValue({
        contentType: 'image/jpeg',
        contentLength: 1024,
      });
      jest
        .spyOn(prismaService.subscription, 'create')
        .mockResolvedValue(subscriptionRow);
    });

    it('creates a pending_review subscription and captures analytics', async () => {
      await expect(
        subscriptionsService.submitSubscription(studentUser, submitInput),
      ).resolves.toEqual({
        id: subscriptionRow.id,
        status: 'pending_review',
        plan: {
          id: activePlan.id,
          name: activePlan.name,
          priceAmount: activePlan.priceAmount,
          currency: activePlan.currency,
          durationDays: activePlan.durationDays,
        },
        receiptSenderName: 'Sender Name',
        createdAt: subscriptionRow.createdAt.toISOString(),
        updatedAt: subscriptionRow.updatedAt.toISOString(),
      });

      expect(prismaService.subscription.create).toHaveBeenCalledWith({
        data: {
          userId: studentUser.id,
          planId: activePlan.id,
          status: 'pending_review',
          receiptStorageKey: submitInput.receiptStorageKey,
          receiptSenderName: submitInput.senderName,
        },
        include: { plan: true },
      });
      expect(
        analyticsService.captureSubscriptionSubmitted,
      ).toHaveBeenCalledWith(studentUser.id, {
        subscriptionId: subscriptionRow.id,
        planId: activePlan.id,
        status: 'pending_review',
      });
      expect(
        receiptVerificationService.scheduleVerification,
      ).toHaveBeenCalledWith(subscriptionRow.id);
    });

    it('throws ConflictException when user already has an open subscription', async () => {
      jest
        .spyOn(prismaService.subscription, 'findFirst')
        .mockImplementation(async (args) => {
          if (
            args &&
            typeof args === 'object' &&
            'where' in args &&
            args.where &&
            typeof args.where === 'object' &&
            'userId' in args.where
          ) {
            return { id: '550e8400-e29b-41d4-a716-446655440004' };
          }

          return null;
        });

      await expect(
        subscriptionsService.submitSubscription(studentUser, submitInput),
      ).rejects.toThrow(
        new ConflictException('User already has an open subscription'),
      );
    });

    it('throws ConflictException when receipt key was already used', async () => {
      jest
        .spyOn(prismaService.subscription, 'findFirst')
        .mockImplementation(async (args) => {
          if (
            args &&
            typeof args === 'object' &&
            'where' in args &&
            args.where &&
            typeof args.where === 'object' &&
            'receiptStorageKey' in args.where
          ) {
            return { id: '550e8400-e29b-41d4-a716-446655440006' };
          }

          return null;
        });

      await expect(
        subscriptionsService.submitSubscription(studentUser, submitInput),
      ).rejects.toThrow(
        new ConflictException(
          'Receipt has already been used for a subscription',
        ),
      );
    });

    it('throws NotFoundException when plan does not exist', async () => {
      jest
        .spyOn(prismaService.subscriptionPlan, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        subscriptionsService.submitSubscription(studentUser, submitInput),
      ).rejects.toThrow(new NotFoundException('Plan not found'));
    });

    it('throws BadRequestException when plan is inactive', async () => {
      jest
        .spyOn(prismaService.subscriptionPlan, 'findUnique')
        .mockResolvedValue({
          id: activePlan.id,
          isActive: false,
        });

      await expect(
        subscriptionsService.submitSubscription(studentUser, submitInput),
      ).rejects.toThrow(new BadRequestException('Plan is not available'));
    });

    it('throws BadRequestException when receipt key does not belong to user', async () => {
      await expect(
        subscriptionsService.submitSubscription(studentUser, {
          ...submitInput,
          receiptStorageKey:
            'receipts/550e8400-e29b-41d4-a716-446655440099/550e8400-e29b-41d4-a716-446655440005.jpg',
        }),
      ).rejects.toThrow(new BadRequestException('Invalid receipt storage key'));
    });

    it('throws BadRequestException when receipt key format is invalid', async () => {
      await expect(
        subscriptionsService.submitSubscription(studentUser, {
          ...submitInput,
          receiptStorageKey: `receipts/${studentUser.id}/invalid-name.jpg`,
        }),
      ).rejects.toThrow(new BadRequestException('Invalid receipt storage key'));
    });

    it('throws BadRequestException when receipt object is missing', async () => {
      jest.spyOn(r2StorageService, 'headObject').mockResolvedValue(null);

      await expect(
        subscriptionsService.submitSubscription(studentUser, submitInput),
      ).rejects.toThrow(
        new BadRequestException('Receipt file was not found in storage'),
      );
    });

    it('throws BadRequestException when receipt file is empty', async () => {
      jest.spyOn(r2StorageService, 'headObject').mockResolvedValue({
        contentType: 'image/jpeg',
        contentLength: 0,
      });

      await expect(
        subscriptionsService.submitSubscription(studentUser, submitInput),
      ).rejects.toThrow(
        new BadRequestException('Receipt file was not uploaded'),
      );
    });

    it('throws BadRequestException when receipt type is not allowed', async () => {
      jest.spyOn(r2StorageService, 'headObject').mockResolvedValue({
        contentType: 'application/pdf',
        contentLength: 1024,
      });

      await expect(
        subscriptionsService.submitSubscription(studentUser, submitInput),
      ).rejects.toThrow(
        new BadRequestException('Receipt file type is not allowed'),
      );
    });

    it('throws BadRequestException when receipt exceeds max size', async () => {
      jest.spyOn(r2StorageService, 'headObject').mockResolvedValue({
        contentType: 'image/jpeg',
        contentLength: 6 * 1024 * 1024,
      });

      await expect(
        subscriptionsService.submitSubscription(studentUser, submitInput),
      ).rejects.toThrow(
        new BadRequestException('Receipt file exceeds maximum size'),
      );
    });

    it('throws ConflictException on open subscription unique constraint race', async () => {
      jest.spyOn(prismaService.subscription, 'create').mockRejectedValue(
        new PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.0.0',
          meta: { target: ['user_id'] },
        }),
      );

      await expect(
        subscriptionsService.submitSubscription(studentUser, submitInput),
      ).rejects.toThrow(
        new ConflictException('User already has an open subscription'),
      );
    });

    it('throws ConflictException on duplicate receipt key unique constraint race', async () => {
      jest.spyOn(prismaService.subscription, 'create').mockRejectedValue(
        new PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.0.0',
          meta: { target: ['receipt_storage_key'] },
        }),
      );

      await expect(
        subscriptionsService.submitSubscription(studentUser, submitInput),
      ).rejects.toThrow(
        new ConflictException(
          'Receipt has already been used for a subscription',
        ),
      );
    });
  });

  describe('getMySubscription', () => {
    it('returns the latest open subscription', async () => {
      jest
        .spyOn(prismaService.subscription, 'findFirst')
        .mockResolvedValue(subscriptionRow);

      await expect(
        subscriptionsService.getMySubscription(studentUser),
      ).resolves.toEqual({
        id: subscriptionRow.id,
        status: 'pending_review',
        plan: {
          id: activePlan.id,
          name: activePlan.name,
          priceAmount: activePlan.priceAmount,
          currency: activePlan.currency,
          durationDays: activePlan.durationDays,
        },
        receiptSenderName: 'Sender Name',
        createdAt: subscriptionRow.createdAt.toISOString(),
        updatedAt: subscriptionRow.updatedAt.toISOString(),
      });
    });

    it('throws NotFoundException when no open subscription exists', async () => {
      jest
        .spyOn(prismaService.subscription, 'findFirst')
        .mockResolvedValue(null);

      await expect(
        subscriptionsService.getMySubscription(studentUser),
      ).rejects.toThrow(new NotFoundException('No open subscription found'));
    });
  });
});
