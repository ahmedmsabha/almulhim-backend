jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    subscription = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
  },
}));

jest.mock('../../lib/storage/r2-storage.service', () => ({
  R2StorageService: class MockR2StorageService {
    getObject = jest.fn();
    headObject = jest.fn();
  },
}));

jest.mock('../../lib/ai/ai-provider.service', () => ({
  AiProviderService: class MockAiProviderService {
    isReceiptAiEnabled = jest.fn();
    getExpectedRecipientNames = jest.fn();
    analyzeReceipt = jest.fn();
  },
  RECEIPT_VERIFICATION_MODEL: 'gemini-3.5-flash',
}));

import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { AiProviderService } from '../../lib/ai/ai-provider.service';
import { PrismaService } from '../../lib/database/prisma.service';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import { DUPLICATE_TRANSACTION_REFERENCE_REASON } from './constants/receipt-verification.constants';
import { ReceiptVerificationService } from './receipt-verification.service';
import { RECEIPT_VERIFICATION_RESULT_VERSION } from './types/receipt-verification-result.types';

describe('ReceiptVerificationService', () => {
  let receiptVerificationService: ReceiptVerificationService;
  let prismaService: PrismaService;
  let r2StorageService: R2StorageService;
  let aiProviderService: AiProviderService;

  const subscriptionId = '550e8400-e29b-41d4-a716-446655440003';
  const receiptStorageKey =
    'receipts/550e8400-e29b-41d4-a716-446655440001/receipt.jpg';

  const pendingSubscription = {
    id: subscriptionId,
    status: 'pending_review' as const,
    receiptStorageKey,
    receiptSenderName: 'Sender Name',
    verificationResult: null,
    verifiedAt: null,
  };

  beforeEach(() => {
    prismaService = new PrismaService();
    r2StorageService = new R2StorageService({} as never);
    aiProviderService = new AiProviderService({} as never);
    receiptVerificationService = new ReceiptVerificationService(
      prismaService,
      r2StorageService,
      aiProviderService,
    );
    jest.spyOn(r2StorageService, 'headObject').mockResolvedValue({
      contentType: 'image/jpeg',
      contentLength: 1024,
    });
    jest
      .spyOn(prismaService.subscription, 'updateMany')
      .mockResolvedValue({ count: 1 });
  });

  it('promotes subscriptions to pending_approval when AI is disabled', async () => {
    jest
      .spyOn(prismaService.subscription, 'findUnique')
      .mockResolvedValueOnce(pendingSubscription);
    jest.spyOn(aiProviderService, 'isReceiptAiEnabled').mockReturnValue(false);

    await receiptVerificationService.verifySubscription(subscriptionId);

    expect(prismaService.subscription.updateMany).toHaveBeenCalledWith({
      where: {
        id: subscriptionId,
        status: 'pending_review',
        verifiedAt: null,
      },
      data: expect.objectContaining({
        status: 'pending_approval',
        verificationResult: expect.objectContaining({
          version: RECEIPT_VERIFICATION_RESULT_VERSION,
          passed: true,
          aiEnabled: false,
        }),
      }),
    });
  });

  it('persists a passing AI result and promotes the subscription', async () => {
    jest
      .spyOn(prismaService.subscription, 'findUnique')
      .mockResolvedValueOnce(pendingSubscription);
    jest.spyOn(aiProviderService, 'isReceiptAiEnabled').mockReturnValue(true);
    jest
      .spyOn(aiProviderService, 'getExpectedRecipientNames')
      .mockReturnValue(['Teacher Name']);
    jest.spyOn(r2StorageService, 'getObject').mockResolvedValue({
      body: Buffer.from('receipt'),
      contentType: 'image/jpeg',
    });
    jest.spyOn(prismaService.subscription, 'findMany').mockResolvedValue([]);
    jest.spyOn(prismaService.subscription, 'findFirst').mockResolvedValue(null);
    jest.spyOn(aiProviderService, 'analyzeReceipt').mockResolvedValue({
      recipientNameDetected: 'Teacher Name',
      recipientMatch: true,
      senderNameDetected: 'Sender Name',
      senderMatch: true,
      transactionReference: 'TX-123',
      appearsDuplicate: false,
      duplicateReason: null,
      notes: null,
    });

    await receiptVerificationService.verifySubscription(subscriptionId);

    expect(aiProviderService.analyzeReceipt).toHaveBeenCalledWith({
      imageBuffer: expect.any(Buffer),
      mediaType: 'image/jpeg',
      expectedRecipientNames: ['Teacher Name'],
      expectedSenderName: 'Sender Name',
      knownTransactionReferences: [],
    });
    expect(prismaService.subscription.updateMany).toHaveBeenCalledWith({
      where: {
        id: subscriptionId,
        status: 'pending_review',
        verifiedAt: null,
      },
      data: expect.objectContaining({
        status: 'pending_approval',
        receiptTransactionReference: 'tx-123',
        verificationResult: expect.objectContaining({
          passed: true,
          checks: expect.objectContaining({
            notDuplicate: expect.objectContaining({
              transactionReference: 'TX-123',
            }),
          }),
        }),
      }),
    });
  });

  it('keeps failed AI checks in pending_review', async () => {
    jest
      .spyOn(prismaService.subscription, 'findUnique')
      .mockResolvedValueOnce(pendingSubscription);
    jest.spyOn(aiProviderService, 'isReceiptAiEnabled').mockReturnValue(true);
    jest
      .spyOn(aiProviderService, 'getExpectedRecipientNames')
      .mockReturnValue(['Teacher Name']);
    jest.spyOn(r2StorageService, 'getObject').mockResolvedValue({
      body: Buffer.from('receipt'),
      contentType: 'image/jpeg',
    });
    jest.spyOn(prismaService.subscription, 'findMany').mockResolvedValue([]);
    jest.spyOn(prismaService.subscription, 'findFirst').mockResolvedValue(null);
    jest.spyOn(aiProviderService, 'analyzeReceipt').mockResolvedValue({
      recipientNameDetected: 'Other Name',
      recipientMatch: false,
      senderNameDetected: 'Sender Name',
      senderMatch: true,
      transactionReference: 'TX-456',
      appearsDuplicate: false,
      duplicateReason: null,
      notes: null,
    });

    await receiptVerificationService.verifySubscription(subscriptionId);

    expect(prismaService.subscription.updateMany).toHaveBeenCalledWith({
      where: {
        id: subscriptionId,
        status: 'pending_review',
        verifiedAt: null,
      },
      data: expect.objectContaining({
        status: 'pending_review',
        verificationResult: expect.objectContaining({
          passed: false,
        }),
      }),
    });
  });

  it('marks duplicate transaction references as failed', async () => {
    jest
      .spyOn(prismaService.subscription, 'findUnique')
      .mockResolvedValueOnce(pendingSubscription);
    jest.spyOn(aiProviderService, 'isReceiptAiEnabled').mockReturnValue(true);
    jest
      .spyOn(aiProviderService, 'getExpectedRecipientNames')
      .mockReturnValue(['Teacher Name']);
    jest.spyOn(r2StorageService, 'getObject').mockResolvedValue({
      body: Buffer.from('receipt'),
      contentType: 'image/jpeg',
    });
    jest.spyOn(prismaService.subscription, 'findMany').mockResolvedValue([
      {
        receiptTransactionReference: 'tx-999',
      },
    ]);
    jest.spyOn(prismaService.subscription, 'findFirst').mockResolvedValue(null);
    jest.spyOn(aiProviderService, 'analyzeReceipt').mockResolvedValue({
      recipientNameDetected: 'Teacher Name',
      recipientMatch: true,
      senderNameDetected: 'Sender Name',
      senderMatch: true,
      transactionReference: 'TX-999',
      appearsDuplicate: false,
      duplicateReason: null,
      notes: null,
    });

    await receiptVerificationService.verifySubscription(subscriptionId);

    expect(prismaService.subscription.updateMany).toHaveBeenCalledWith({
      where: {
        id: subscriptionId,
        status: 'pending_review',
        verifiedAt: null,
      },
      data: expect.objectContaining({
        status: 'pending_review',
        verificationResult: expect.objectContaining({
          passed: false,
          checks: expect.objectContaining({
            notDuplicate: expect.objectContaining({
              passed: false,
              transactionReference: 'TX-999',
            }),
          }),
        }),
      }),
    });
  });

  it('does not reprocess subscriptions that were already verified', async () => {
    jest.spyOn(prismaService.subscription, 'findUnique').mockResolvedValue({
      ...pendingSubscription,
      verifiedAt: new Date('2026-06-30T12:00:00.000Z'),
    });
    jest.spyOn(prismaService.subscription, 'update');
    jest.spyOn(prismaService.subscription, 'updateMany');

    await receiptVerificationService.verifySubscription(subscriptionId);

    expect(prismaService.subscription.updateMany).not.toHaveBeenCalled();
    expect(prismaService.subscription.update).not.toHaveBeenCalled();
  });

  it('persists AI failures without changing status to pending_approval', async () => {
    jest
      .spyOn(prismaService.subscription, 'findUnique')
      .mockResolvedValueOnce(pendingSubscription);
    jest.spyOn(aiProviderService, 'isReceiptAiEnabled').mockReturnValue(true);
    jest
      .spyOn(aiProviderService, 'getExpectedRecipientNames')
      .mockReturnValue(['Teacher Name']);
    jest.spyOn(r2StorageService, 'getObject').mockResolvedValue({
      body: Buffer.from('receipt'),
      contentType: 'image/jpeg',
    });
    jest.spyOn(prismaService.subscription, 'findMany').mockResolvedValue([]);
    jest
      .spyOn(aiProviderService, 'analyzeReceipt')
      .mockRejectedValue(new Error('Gemini unavailable'));

    await receiptVerificationService.verifySubscription(subscriptionId);

    expect(prismaService.subscription.updateMany).toHaveBeenCalledWith({
      where: {
        id: subscriptionId,
        status: 'pending_review',
        verifiedAt: null,
      },
      data: expect.objectContaining({
        status: 'pending_review',
        verificationResult: expect.objectContaining({
          passed: false,
          error: 'Gemini unavailable',
        }),
      }),
    });
  });

  it('re-checks transaction references at persist time before promotion', async () => {
    jest
      .spyOn(prismaService.subscription, 'findUnique')
      .mockResolvedValueOnce(pendingSubscription);
    jest.spyOn(aiProviderService, 'isReceiptAiEnabled').mockReturnValue(true);
    jest
      .spyOn(aiProviderService, 'getExpectedRecipientNames')
      .mockReturnValue(['Teacher Name']);
    jest.spyOn(r2StorageService, 'getObject').mockResolvedValue({
      body: Buffer.from('receipt'),
      contentType: 'image/jpeg',
    });
    jest.spyOn(prismaService.subscription, 'findMany').mockResolvedValue([
      {
        receiptTransactionReference: 'tx-race',
        verificationResult: null,
      },
    ]);
    jest.spyOn(aiProviderService, 'analyzeReceipt').mockResolvedValue({
      recipientNameDetected: 'Teacher Name',
      recipientMatch: true,
      senderNameDetected: 'Sender Name',
      senderMatch: true,
      transactionReference: 'TX-RACE',
      appearsDuplicate: false,
      duplicateReason: null,
      notes: null,
    });

    await receiptVerificationService.verifySubscription(subscriptionId);

    expect(prismaService.subscription.updateMany).toHaveBeenCalledWith({
      where: {
        id: subscriptionId,
        status: 'pending_review',
        verifiedAt: null,
      },
      data: expect.objectContaining({
        status: 'pending_review',
        receiptTransactionReference: null,
        verificationResult: expect.objectContaining({
          passed: false,
          checks: expect.objectContaining({
            notDuplicate: expect.objectContaining({
              passed: false,
              reason: DUPLICATE_TRANSACTION_REFERENCE_REASON,
            }),
          }),
        }),
      }),
    });
  });

  it('maps receipt transaction reference P2002 to a duplicate pending_review outcome', async () => {
    jest
      .spyOn(prismaService.subscription, 'findUnique')
      .mockResolvedValueOnce(pendingSubscription);
    jest.spyOn(aiProviderService, 'isReceiptAiEnabled').mockReturnValue(true);
    jest
      .spyOn(aiProviderService, 'getExpectedRecipientNames')
      .mockReturnValue(['Teacher Name']);
    jest.spyOn(r2StorageService, 'getObject').mockResolvedValue({
      body: Buffer.from('receipt'),
      contentType: 'image/jpeg',
    });
    jest.spyOn(prismaService.subscription, 'findMany').mockResolvedValue([]);
    jest.spyOn(prismaService.subscription, 'findFirst').mockResolvedValue(null);
    jest.spyOn(aiProviderService, 'analyzeReceipt').mockResolvedValue({
      recipientNameDetected: 'Teacher Name',
      recipientMatch: true,
      senderNameDetected: 'Sender Name',
      senderMatch: true,
      transactionReference: 'TX-LOCK',
      appearsDuplicate: false,
      duplicateReason: null,
      notes: null,
    });
    jest
      .spyOn(prismaService.subscription, 'updateMany')
      .mockRejectedValueOnce(
        new PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.0.0',
          meta: { target: ['receipt_transaction_reference'] },
        }),
      )
      .mockResolvedValueOnce({ count: 1 });

    await receiptVerificationService.verifySubscription(subscriptionId);

    expect(prismaService.subscription.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: subscriptionId,
        status: 'pending_review',
        verifiedAt: null,
      },
      data: expect.objectContaining({
        status: 'pending_approval',
        receiptTransactionReference: 'tx-lock',
      }),
    });
    expect(prismaService.subscription.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: subscriptionId,
        status: 'pending_review',
        verifiedAt: null,
      },
      data: expect.objectContaining({
        status: 'pending_review',
        receiptTransactionReference: null,
        verificationResult: expect.objectContaining({
          passed: false,
          checks: expect.objectContaining({
            notDuplicate: expect.objectContaining({
              passed: false,
              reason: DUPLICATE_TRANSACTION_REFERENCE_REASON,
            }),
          }),
        }),
      }),
    });
  });

  it('loads transaction references from verification result JSON', async () => {
    jest
      .spyOn(prismaService.subscription, 'findUnique')
      .mockResolvedValueOnce(pendingSubscription);
    jest.spyOn(aiProviderService, 'isReceiptAiEnabled').mockReturnValue(true);
    jest
      .spyOn(aiProviderService, 'getExpectedRecipientNames')
      .mockReturnValue(['Teacher Name']);
    jest.spyOn(r2StorageService, 'getObject').mockResolvedValue({
      body: Buffer.from('receipt'),
      contentType: 'image/jpeg',
    });
    jest.spyOn(prismaService.subscription, 'findMany').mockResolvedValue([
      {
        receiptTransactionReference: null,
        verificationResult: {
          version: RECEIPT_VERIFICATION_RESULT_VERSION,
          passed: false,
          verifiedAt: new Date().toISOString(),
          aiEnabled: true,
          model: 'gemini-3.5-flash',
          error: null,
          checks: {
            recipientMatch: {
              passed: true,
              detected: 'Teacher Name',
              reason: null,
            },
            senderMatch: {
              passed: false,
              detected: 'Other',
              expected: 'Sender Name',
              reason: 'Mismatch',
            },
            notDuplicate: {
              passed: false,
              detected: 'TX-555',
              transactionReference: 'TX-555',
              reason: 'Sender mismatch',
            },
          },
          notes: null,
        },
      },
    ]);
    jest.spyOn(aiProviderService, 'analyzeReceipt').mockResolvedValue({
      recipientNameDetected: 'Teacher Name',
      recipientMatch: true,
      senderNameDetected: 'Sender Name',
      senderMatch: true,
      transactionReference: 'TX-777',
      appearsDuplicate: false,
      duplicateReason: null,
      notes: null,
    });

    await receiptVerificationService.verifySubscription(subscriptionId);

    expect(aiProviderService.analyzeReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        knownTransactionReferences: ['tx-555'],
      }),
    );
  });

  it('skips concurrent verification attempts while one is in flight', async () => {
    (
      receiptVerificationService as unknown as {
        inFlightVerifications: Map<string, number>;
      }
    ).inFlightVerifications.set(subscriptionId, Date.now());

    await receiptVerificationService.verifySubscription(subscriptionId);

    expect(prismaService.subscription.findUnique).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing failed verification when claim loses', async () => {
    jest
      .spyOn(prismaService.subscription, 'findUnique')
      .mockResolvedValueOnce(pendingSubscription);
    jest.spyOn(aiProviderService, 'isReceiptAiEnabled').mockReturnValue(true);
    jest
      .spyOn(aiProviderService, 'getExpectedRecipientNames')
      .mockReturnValue(['Teacher Name']);
    jest.spyOn(r2StorageService, 'getObject').mockResolvedValue({
      body: Buffer.from('receipt'),
      contentType: 'image/jpeg',
    });
    jest.spyOn(prismaService.subscription, 'findMany').mockResolvedValue([]);
    jest.spyOn(aiProviderService, 'analyzeReceipt').mockResolvedValue({
      recipientNameDetected: 'Teacher Name',
      recipientMatch: true,
      senderNameDetected: 'Sender Name',
      senderMatch: true,
      transactionReference: 'TX-WINNER',
      appearsDuplicate: false,
      duplicateReason: null,
      notes: null,
    });
    jest
      .spyOn(prismaService.subscription, 'updateMany')
      .mockResolvedValue({ count: 0 });
    jest.spyOn(prismaService.subscription, 'update');

    await receiptVerificationService.verifySubscription(subscriptionId);

    expect(prismaService.subscription.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaService.subscription.update).not.toHaveBeenCalled();
  });

  it('ignores transaction references from rejected subscriptions', async () => {
    jest
      .spyOn(prismaService.subscription, 'findUnique')
      .mockResolvedValueOnce(pendingSubscription);
    jest.spyOn(aiProviderService, 'isReceiptAiEnabled').mockReturnValue(true);
    jest
      .spyOn(aiProviderService, 'getExpectedRecipientNames')
      .mockReturnValue(['Teacher Name']);
    jest.spyOn(r2StorageService, 'getObject').mockResolvedValue({
      body: Buffer.from('receipt'),
      contentType: 'image/jpeg',
    });
    jest.spyOn(prismaService.subscription, 'findMany').mockResolvedValue([]);
    jest.spyOn(aiProviderService, 'analyzeReceipt').mockResolvedValue({
      recipientNameDetected: 'Teacher Name',
      recipientMatch: true,
      senderNameDetected: 'Sender Name',
      senderMatch: true,
      transactionReference: 'TX-RETRY',
      appearsDuplicate: false,
      duplicateReason: null,
      notes: null,
    });

    await receiptVerificationService.verifySubscription(subscriptionId);

    expect(prismaService.subscription.findMany).toHaveBeenCalledWith({
      where: {
        id: { not: subscriptionId },
        status: { not: 'rejected' },
      },
      select: {
        receiptTransactionReference: true,
        verificationResult: true,
      },
    });
    expect(aiProviderService.analyzeReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        knownTransactionReferences: [],
      }),
    );
  });
});
