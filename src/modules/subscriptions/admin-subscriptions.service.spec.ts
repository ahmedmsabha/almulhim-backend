jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    subscription = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
  },
}));
jest.mock('../../lib/storage/r2-storage.service', () => ({
  R2StorageService: class MockR2StorageService {
    createSignedGetUrl = jest.fn();
  },
}));

jest.mock('../../lib/analytics/analytics.service', () => ({
  AnalyticsService: class MockAnalyticsService {
    captureSubscriptionApproved = jest.fn();
    captureSubscriptionRejected = jest.fn();
    captureSubscriptionSuspended = jest.fn();
    captureSubscriptionExpired = jest.fn();
  },
}));

jest.mock('./receipt-verification.service', () => ({
  ReceiptVerificationService: class MockReceiptVerificationService {
    assertTransactionReferenceAvailable = jest.fn();
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
import { AdminSubscriptionsService } from './admin-subscriptions.service';

describe('AdminSubscriptionsService', () => {
  let service: AdminSubscriptionsService;
  let prismaService: PrismaService;
  let r2StorageService: R2StorageService;
  let analyticsService: AnalyticsService;
  let receiptVerificationService: ReceiptVerificationService;

  const studentUser = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clerkId: 'user_clerk_123',
    email: 'student@example.com',
    fullName: 'Ahmed Student',
    phoneNumber: '0599000001',
    telegramUsername: 'ahmed_tg',
    region: 'gaza' as const,
    role: 'student' as const,
    deactivatedAt: null as Date | null,
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  const plan = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Monthly',
    description: 'One month access',
    priceAmount: 9900,
    currency: 'ILS',
    durationDays: 30,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  const receiptStorageKey = `receipts/${studentUser.id}/550e8400-e29b-41d4-a716-446655440009.jpg`;

  const pendingRow = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    userId: studentUser.id,
    planId: plan.id,
    status: 'pending_approval' as const,
    receiptStorageKey,
    receiptSenderName: 'Sender Name',
    receiptTransactionReference: null,
    verificationResult: null,
    verifiedAt: null,
    approvedAt: null,
    rejectedAt: null,
    expiresAt: null,
    suspendedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-07-01T09:00:00.000Z'),
    updatedAt: new Date('2026-07-01T09:00:00.000Z'),
    plan,
    user: studentUser,
  };

  const adminClerkId = 'admin_clerk_456';

  beforeEach(() => {
    prismaService = new PrismaService();
    r2StorageService = new R2StorageService();
    analyticsService = new AnalyticsService({} as never);
    receiptVerificationService = new ReceiptVerificationService();

    service = new AdminSubscriptionsService(
      prismaService,
      r2StorageService,
      analyticsService,
      receiptVerificationService,
    );

    jest.clearAllMocks();
  });

  describe('listPending', () => {
    it('returns subscriptions in pending_review and pending_approval', async () => {
      jest
        .spyOn(prismaService.subscription, 'findMany')
        .mockResolvedValue([pendingRow] as never);

      const result = await service.listPending();

      expect(prismaService.subscription.findMany).toHaveBeenCalledWith({
        where: { status: { in: ['pending_review', 'pending_approval'] } },
        include: { plan: true, user: true },
        orderBy: { createdAt: 'asc' },
      });

      expect(result.subscriptions).toHaveLength(1);
      expect(result.subscriptions[0].id).toBe(pendingRow.id);
      expect(result.subscriptions[0].student.fullName).toBe(
        studentUser.fullName,
      );
      expect(result.subscriptions[0].plan.name).toBe(plan.name);
    });

    it('returns empty list when no pending subscriptions exist', async () => {
      jest
        .spyOn(prismaService.subscription, 'findMany')
        .mockResolvedValue([] as never);

      const result = await service.listPending();

      expect(result.subscriptions).toHaveLength(0);
    });
  });

  describe('listArchived', () => {
    it('returns non-pending decided subscriptions ordered by updatedAt desc', async () => {
      const archivedRow = {
        ...pendingRow,
        status: 'active' as const,
        approvedAt: new Date('2026-07-01T11:00:00.000Z'),
        expiresAt: new Date('2026-07-31T11:00:00.000Z'),
        updatedAt: new Date('2026-07-01T11:00:00.000Z'),
      };

      jest
        .spyOn(prismaService.subscription, 'findMany')
        .mockResolvedValue([archivedRow] as never);

      const result = await service.listArchived();

      expect(prismaService.subscription.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['active', 'rejected', 'suspended', 'expired'] },
        },
        include: { plan: true, user: true },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result.subscriptions).toHaveLength(1);
      expect(result.subscriptions[0].status).toBe('active');
    });

    it('excludes pending statuses from the archived query filter', async () => {
      jest
        .spyOn(prismaService.subscription, 'findMany')
        .mockResolvedValue([] as never);

      await service.listArchived();

      const call = (prismaService.subscription.findMany as jest.Mock).mock
        .calls[0][0] as {
        where: { status: { in: string[] } };
      };
      expect(call.where.status.in).not.toContain('pending_review');
      expect(call.where.status.in).not.toContain('pending_approval');
    });
  });

  describe('listAiLogs', () => {
    it('includes failed verification payloads with error set', async () => {
      const failedResult = {
        version: 1 as const,
        passed: false,
        verifiedAt: '2026-07-01T10:05:00.000Z',
        aiEnabled: true,
        model: 'gemini-3.1-flash-lite',
        error: 'Gemini timed out',
        checks: {
          recipientMatch: {
            passed: false,
            detected: null,
            reason: 'Gemini timed out',
          },
          senderMatch: {
            passed: false,
            detected: null,
            expected: 'Sender Name',
            reason: 'Gemini timed out',
          },
          notDuplicate: {
            passed: false,
            detected: null,
            transactionReference: null,
            reason: 'Gemini timed out',
          },
        },
        notes: null,
      };
      const logRow = {
        ...pendingRow,
        status: 'pending_review' as const,
        verificationResult: failedResult,
        verifiedAt: new Date('2026-07-01T10:05:00.000Z'),
      };

      jest
        .spyOn(prismaService.subscription, 'findMany')
        .mockResolvedValue([logRow] as never);

      const result = await service.listAiLogs();

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].subscriptionId).toBe(logRow.id);
      expect(result.logs[0].verificationResult).toEqual(failedResult);
      expect(result.logs[0].verificationResult?.error).toBe('Gemini timed out');
      expect(result.logs[0].verifiedAt).toBe('2026-07-01T10:05:00.000Z');
      expect(prismaService.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ verifiedAt: 'desc' }, { updatedAt: 'desc' }],
        }),
      );
    });
  });

  describe('getSubscriptionById', () => {
    it('returns the admin DTO for a pending subscription', async () => {
      const verificationResult = {
        version: 1 as const,
        passed: true,
        verifiedAt: '2026-07-01T10:00:00.000Z',
        aiEnabled: true,
        model: 'gemini-3.1-flash-lite',
        error: null,
        checks: {
          recipientMatch: {
            passed: true,
            detected: 'Teacher Name',
            reason: null,
          },
          senderMatch: {
            passed: true,
            detected: 'Sender Name',
            expected: 'Sender Name',
            reason: null,
          },
          notDuplicate: {
            passed: true,
            detected: 'TX-123',
            transactionReference: 'TX-123',
            reason: null,
          },
        },
        notes: null,
      };
      const row = {
        ...pendingRow,
        verificationResult,
        verifiedAt: new Date('2026-07-01T10:00:00.000Z'),
      };

      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(row);

      const result = await service.getSubscriptionById(pendingRow.id);

      expect(prismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { id: pendingRow.id },
        include: { plan: true, user: true },
      });
      expect(result).toEqual({
        id: pendingRow.id,
        status: 'pending_approval',
        plan: expect.objectContaining({ id: plan.id, name: plan.name }),
        student: expect.objectContaining({
          id: studentUser.id,
          fullName: studentUser.fullName,
        }),
        receiptSenderName: pendingRow.receiptSenderName,
        verificationResult,
        verifiedAt: '2026-07-01T10:00:00.000Z',
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        expiresAt: null,
        suspendedAt: null,
        createdAt: pendingRow.createdAt.toISOString(),
        updatedAt: pendingRow.updatedAt.toISOString(),
      });
    });

    it('returns non-pending statuses when the subscription exists', async () => {
      const activeRow = {
        ...pendingRow,
        status: 'active' as const,
        approvedAt: new Date('2026-07-01T12:00:00.000Z'),
        expiresAt: new Date('2026-07-31T12:00:00.000Z'),
      };

      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(activeRow);

      const result = await service.getSubscriptionById(pendingRow.id);

      expect(result.status).toBe('active');
      expect(result.approvedAt).toBe('2026-07-01T12:00:00.000Z');
      expect(result.expiresAt).toBe('2026-07-31T12:00:00.000Z');
    });

    it('throws NotFoundException when subscription does not exist', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(service.getSubscriptionById(pendingRow.id)).rejects.toThrow(
        new NotFoundException('Subscription not found'),
      );
    });
  });

  describe('getReceiptUrl', () => {
    it('returns a signed GET URL for the receipt', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(pendingRow);
      jest
        .spyOn(r2StorageService, 'createSignedGetUrl')
        .mockResolvedValue('https://r2.example.com/signed-url');

      const result = await service.getReceiptUrl(pendingRow.id);

      expect(result.url).toBe('https://r2.example.com/signed-url');
      expect(result.expiresInSeconds).toBe(15 * 60);
      expect(r2StorageService.createSignedGetUrl).toHaveBeenCalledWith({
        key: receiptStorageKey,
        expiresInSeconds: 15 * 60,
      });
    });

    it('throws NotFoundException when subscription does not exist', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(service.getReceiptUrl(pendingRow.id)).rejects.toThrow(
        new NotFoundException('Subscription not found'),
      );
    });

    it('throws BadRequestException when subscription has no receipt key', async () => {
      const noReceiptRow = { ...pendingRow, receiptStorageKey: null };
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(noReceiptRow);

      await expect(service.getReceiptUrl(pendingRow.id)).rejects.toThrow(
        new BadRequestException('Subscription has no receipt on file'),
      );
    });
  });

  describe('approveSubscription', () => {
    it('moves pending_approval subscription to active and captures PostHog event', async () => {
      const approvedAt = new Date('2026-07-01T12:00:00.000Z');
      const expectedExpiresAt = new Date(
        approvedAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000,
      );

      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValueOnce(pendingRow)
        .mockResolvedValueOnce({
          ...pendingRow,
          status: 'active' as const,
          approvedAt,
          expiresAt: expectedExpiresAt,
        });

      jest
        .spyOn(prismaService.subscription, 'updateMany')
        .mockResolvedValue({ count: 1 });

      const result = await service.approveSubscription(
        pendingRow.id,
        adminClerkId,
      );

      expect(result.status).toBe('active');
      expect(prismaService.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: pendingRow.id,
            status: { in: ['pending_review', 'pending_approval'] },
          },
          data: expect.objectContaining({ status: 'active' }),
        }),
      );

      expect(analyticsService.captureSubscriptionApproved).toHaveBeenCalledWith(
        studentUser.id,
        {
          subscriptionId: pendingRow.id,
          userId: studentUser.id,
          adminClerkId,
        },
      );
    });

    it('also approves from pending_review (admin override)', async () => {
      const reviewRow = { ...pendingRow, status: 'pending_review' as const };
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValueOnce(reviewRow)
        .mockResolvedValueOnce({ ...reviewRow, status: 'active' } as never);
      jest
        .spyOn(prismaService.subscription, 'updateMany')
        .mockResolvedValue({ count: 1 });

      const result = await service.approveSubscription(
        pendingRow.id,
        adminClerkId,
      );

      expect(result.status).toBe('active');
    });

    it('throws ConflictException when duplicate transaction reference is claimed during approval', async () => {
      const reviewRow = {
        ...pendingRow,
        status: 'pending_review' as const,
        verificationResult: {
          checks: {
            notDuplicate: {
              transactionReference: 'TXN-123',
            },
          },
        },
      };

      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(reviewRow);
      jest.spyOn(prismaService.subscription, 'updateMany').mockRejectedValue(
        new PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.8.0',
          meta: { target: ['receipt_transaction_reference'] },
        }),
      );

      await expect(
        service.approveSubscription(pendingRow.id, adminClerkId),
      ).rejects.toThrow(
        new ConflictException(
          'Receipt transaction reference is already in use',
        ),
      );
    });

    it('throws BadRequestException when subscription is not in a pending status', async () => {
      const activeRow = { ...pendingRow, status: 'active' as const };
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(activeRow);

      await expect(
        service.approveSubscription(pendingRow.id, adminClerkId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when subscription does not exist', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.approveSubscription(pendingRow.id, adminClerkId),
      ).rejects.toThrow(new NotFoundException('Subscription not found'));
    });
  });

  describe('rejectSubscription', () => {
    it('moves pending subscription to rejected and captures PostHog event', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValueOnce(pendingRow)
        .mockResolvedValueOnce({
          ...pendingRow,
          status: 'rejected' as const,
          rejectedAt: new Date(),
          rejectionReason: 'Payment not recognized',
          receiptTransactionReference: null,
        });

      jest
        .spyOn(prismaService.subscription, 'updateMany')
        .mockResolvedValue({ count: 1 });

      const result = await service.rejectSubscription(
        pendingRow.id,
        adminClerkId,
        { rejectionReason: 'Payment not recognized' },
      );

      expect(result.status).toBe('rejected');
      expect(prismaService.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: pendingRow.id,
            status: {
              in: ['pending_review', 'pending_approval', 'suspended'],
            },
          },
          data: expect.objectContaining({
            status: 'rejected',
            rejectionReason: 'Payment not recognized',
            receiptTransactionReference: null,
          }),
        }),
      );

      expect(analyticsService.captureSubscriptionRejected).toHaveBeenCalledWith(
        studentUser.id,
        {
          subscriptionId: pendingRow.id,
          userId: studentUser.id,
          adminClerkId,
        },
      );
    });

    it('rejects without a reason when body is empty', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValueOnce(pendingRow)
        .mockResolvedValueOnce({
          ...pendingRow,
          status: 'rejected' as const,
          rejectedAt: new Date(),
          rejectionReason: null,
          receiptTransactionReference: null,
        });

      jest
        .spyOn(prismaService.subscription, 'updateMany')
        .mockResolvedValue({ count: 1 });

      const result = await service.rejectSubscription(
        pendingRow.id,
        adminClerkId,
        {},
      );

      expect(result.status).toBe('rejected');
      expect(prismaService.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rejectionReason: null,
            receiptTransactionReference: null,
          }),
        }),
      );
    });

    it('throws BadRequestException when subscription is not in a pending status', async () => {
      const activeRow = { ...pendingRow, status: 'active' as const };
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(activeRow);

      await expect(
        service.rejectSubscription(pendingRow.id, adminClerkId, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when concurrent reject loses the race', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(pendingRow);
      jest
        .spyOn(prismaService.subscription, 'updateMany')
        .mockResolvedValue({ count: 0 });

      await expect(
        service.rejectSubscription(pendingRow.id, adminClerkId, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects suspended subscriptions so students can resubmit', async () => {
      const suspendedRow = { ...pendingRow, status: 'suspended' as const };
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValueOnce(suspendedRow)
        .mockResolvedValueOnce({
          ...suspendedRow,
          status: 'rejected' as const,
          rejectedAt: new Date(),
          rejectionReason: 'Suspended access cleared',
          receiptTransactionReference: null,
        });

      jest
        .spyOn(prismaService.subscription, 'updateMany')
        .mockResolvedValue({ count: 1 });

      const result = await service.rejectSubscription(
        pendingRow.id,
        adminClerkId,
        { rejectionReason: 'Suspended access cleared' },
      );

      expect(result.status).toBe('rejected');
    });

    it('throws NotFoundException when subscription does not exist', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.rejectSubscription(pendingRow.id, adminClerkId, {}),
      ).rejects.toThrow(new NotFoundException('Subscription not found'));
    });
  });

  describe('suspendSubscription', () => {
    it('moves active subscription to suspended and captures PostHog event', async () => {
      const activeRow = { ...pendingRow, status: 'active' as const };
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(activeRow);

      const suspendedRow = {
        ...activeRow,
        status: 'suspended' as const,
        suspendedAt: new Date(),
      };
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(suspendedRow);

      const result = await service.suspendSubscription(
        pendingRow.id,
        adminClerkId,
      );

      expect(result.status).toBe('suspended');
      expect(prismaService.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: pendingRow.id },
          data: expect.objectContaining({ status: 'suspended' }),
        }),
      );

      expect(
        analyticsService.captureSubscriptionSuspended,
      ).toHaveBeenCalledWith(studentUser.id, {
        subscriptionId: pendingRow.id,
        userId: studentUser.id,
        adminClerkId,
      });
    });

    it('throws BadRequestException when subscription is not active', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(pendingRow);

      await expect(
        service.suspendSubscription(pendingRow.id, adminClerkId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when subscription does not exist', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.suspendSubscription(pendingRow.id, adminClerkId),
      ).rejects.toThrow(new NotFoundException('Subscription not found'));
    });
  });

  describe('expireStaleSubscriptions', () => {
    it('expires stale subscriptions individually and captures one analytics event per transition', async () => {
      const staleSubscription = {
        id: pendingRow.id,
        userId: studentUser.id,
        planId: plan.id,
      };

      jest
        .spyOn(prismaService.subscription, 'findMany')
        .mockResolvedValueOnce([staleSubscription] as never)
        .mockResolvedValueOnce([] as never);
      jest
        .spyOn(prismaService.subscription, 'updateMany')
        .mockResolvedValue({ count: 1 });

      await service.expireStaleSubscriptions();

      expect(prismaService.subscription.updateMany).toHaveBeenCalledWith({
        where: {
          id: staleSubscription.id,
          status: { in: ['active', 'suspended'] },
          expiresAt: { lte: expect.any(Date) },
        },
        data: { status: 'expired' },
      });
      expect(analyticsService.captureSubscriptionExpired).toHaveBeenCalledWith(
        studentUser.id,
        {
          subscriptionId: staleSubscription.id,
          planId: plan.id,
        },
      );
    });

    it('does not capture analytics when the guarded transition updates zero rows', async () => {
      const staleSubscription = {
        id: pendingRow.id,
        userId: studentUser.id,
        planId: plan.id,
      };

      jest
        .spyOn(prismaService.subscription, 'findMany')
        .mockResolvedValueOnce([staleSubscription] as never)
        .mockResolvedValueOnce([] as never);
      jest
        .spyOn(prismaService.subscription, 'updateMany')
        .mockResolvedValue({ count: 0 });

      await service.expireStaleSubscriptions();

      expect(
        analyticsService.captureSubscriptionExpired,
      ).not.toHaveBeenCalled();
    });

    it('does nothing when no stale subscriptions exist', async () => {
      jest
        .spyOn(prismaService.subscription, 'findMany')
        .mockResolvedValue([] as never);

      await expect(service.expireStaleSubscriptions()).resolves.not.toThrow();
      expect(prismaService.subscription.updateMany).not.toHaveBeenCalled();
    });
  });
});
