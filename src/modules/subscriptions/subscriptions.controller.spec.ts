jest.mock('./subscriptions.service', () => ({
  SubscriptionsService: class MockSubscriptionsService {},
}));

import { BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsController', () => {
  let subscriptionsController: SubscriptionsController;
  let subscriptionsService: jest.Mocked<
    Pick<
      SubscriptionsService,
      'createReceiptUploadUrl' | 'submitSubscription' | 'getMySubscription'
    >
  >;

  const subscriptionResponse = {
    id: 'subscription-uuid-1',
    status: 'pending_review' as const,
    plan: {
      id: 'plan-uuid-1',
      name: 'Monthly',
      priceAmount: 9900,
      currency: 'ILS',
      durationDays: 30,
    },
    receiptSenderName: 'Sender Name',
    createdAt: '2026-06-30T11:00:00.000Z',
    updatedAt: '2026-06-30T11:00:00.000Z',
  };

  beforeEach(() => {
    subscriptionsService = {
      createReceiptUploadUrl: jest.fn(),
      submitSubscription: jest.fn(),
      getMySubscription: jest.fn(),
    };
    subscriptionsController = new SubscriptionsController(
      subscriptionsService as unknown as SubscriptionsService,
    );
  });

  it('delegates createReceiptUploadUrl to the service', async () => {
    subscriptionsService.createReceiptUploadUrl.mockResolvedValue({
      uploadUrl: 'https://upload.example.com',
      receiptStorageKey: 'receipts/user-uuid/receipt.jpg',
      expiresInSeconds: 900,
    });

    await expect(
      subscriptionsController.createReceiptUploadUrl('user_123', {
        contentType: 'image/jpeg',
      }),
    ).resolves.toEqual({
      uploadUrl: 'https://upload.example.com',
      receiptStorageKey: 'receipts/user-uuid/receipt.jpg',
      expiresInSeconds: 900,
    });

    expect(subscriptionsService.createReceiptUploadUrl).toHaveBeenCalledWith(
      'user_123',
      { contentType: 'image/jpeg' },
    );
  });

  it('maps Zod validation errors to BadRequestException on upload URL', async () => {
    subscriptionsService.createReceiptUploadUrl.mockRejectedValue(
      new ZodError([
        {
          code: 'invalid_enum_value',
          received: 'application/pdf',
          options: ['image/jpeg', 'image/png', 'image/webp'],
          path: ['contentType'],
          message: 'Invalid enum value',
        },
      ]),
    );

    await expect(
      subscriptionsController.createReceiptUploadUrl('user_123', {
        contentType: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delegates submitSubscription to the service', async () => {
    subscriptionsService.submitSubscription.mockResolvedValue(subscriptionResponse);

    await expect(
      subscriptionsController.submitSubscription('user_123', {
        planId: 'plan-uuid-1',
        senderName: 'Sender Name',
        receiptStorageKey: 'receipts/user-uuid/receipt.jpg',
      }),
    ).resolves.toEqual(subscriptionResponse);

    expect(subscriptionsService.submitSubscription).toHaveBeenCalledWith(
      'user_123',
      {
        planId: 'plan-uuid-1',
        senderName: 'Sender Name',
        receiptStorageKey: 'receipts/user-uuid/receipt.jpg',
      },
    );
  });

  it('maps Zod validation errors to BadRequestException on submit', async () => {
    subscriptionsService.submitSubscription.mockRejectedValue(
      new ZodError([
        {
          code: 'too_small',
          minimum: 2,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'String must contain at least 2 character(s)',
          path: ['senderName'],
        },
      ]),
    );

    await expect(
      subscriptionsController.submitSubscription('user_123', {
        planId: 'plan-uuid-1',
        senderName: 'A',
        receiptStorageKey: 'receipts/user-uuid/receipt.jpg',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delegates getMySubscription to the service', async () => {
    subscriptionsService.getMySubscription.mockResolvedValue(subscriptionResponse);

    await expect(
      subscriptionsController.getMySubscription('user_123'),
    ).resolves.toEqual(subscriptionResponse);

    expect(subscriptionsService.getMySubscription).toHaveBeenCalledWith(
      'user_123',
    );
  });
});
