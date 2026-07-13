jest.mock('./support.service', () => ({
  SupportService: class MockSupportService {},
}));

import { BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

describe('SupportController', () => {
  let supportController: SupportController;
  let supportService: jest.Mocked<
    Pick<SupportService, 'create' | 'listMine'>
  >;

  const user = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    fullName: 'Student One',
    email: 'student@example.com',
    phoneNumber: '0599000000',
    telegramUsername: 'student',
    region: 'gaza' as const,
    role: 'student' as const,
    clerkId: 'clerk_student',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    supportService = {
      create: jest.fn(),
      listMine: jest.fn(),
    };
    supportController = new SupportController(
      supportService as unknown as SupportService,
    );
  });

  it('delegates create to the service', async () => {
    supportService.create.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440020',
      subject: 'Help',
      message: 'Need help',
      status: 'open',
      adminReply: null,
      reviewedAt: null,
      closedAt: null,
      createdAt: '2026-07-01T08:00:00.000Z',
    });

    await expect(
      supportController.create(user, {
        subject: 'Help',
        message: 'Need help',
      }),
    ).resolves.toMatchObject({ status: 'open' });
  });

  it('maps Zod validation errors to BadRequestException on create', async () => {
    supportService.create.mockRejectedValue(
      new ZodError([
        {
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Required',
          path: ['subject'],
        },
      ]),
    );

    await expect(
      supportController.create(user, { message: 'Need help' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
