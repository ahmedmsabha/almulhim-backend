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
      subscriptionsController.createReceiptUploadUrl(studentUser, {
        contentType: 'image/jpeg',
      }),
    ).resolves.toEqual({
      uploadUrl: 'https://upload.example.com',
      receiptStorageKey: 'receipts/user-uuid/receipt.jpg',
      expiresInSeconds: 900,
    });

    expect(subscriptionsService.createReceiptUploadUrl).toHaveBeenCalledWith(
      studentUser,
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
      subscriptionsController.createReceiptUploadUrl(studentUser, {
        contentType: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delegates submitSubscription to the service', async () => {
    subscriptionsService.submitSubscription.mockResolvedValue(
      subscriptionResponse,
    );

    await expect(
      subscriptionsController.submitSubscription(studentUser, {
        planId: 'plan-uuid-1',
        senderName: 'Sender Name',
        receiptStorageKey: 'receipts/user-uuid/receipt.jpg',
      }),
    ).resolves.toEqual(subscriptionResponse);

    expect(subscriptionsService.submitSubscription).toHaveBeenCalledWith(
      studentUser,
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
      subscriptionsController.submitSubscription(studentUser, {
        planId: 'plan-uuid-1',
        senderName: 'A',
        receiptStorageKey: 'receipts/user-uuid/receipt.jpg',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delegates getMySubscription to the service', async () => {
    subscriptionsService.getMySubscription.mockResolvedValue(
      subscriptionResponse,
    );

    await expect(
      subscriptionsController.getMySubscription(studentUser),
    ).resolves.toEqual(subscriptionResponse);

    expect(subscriptionsService.getMySubscription).toHaveBeenCalledWith(
      studentUser,
    );
  });
});
