jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    supportRequest = {
      create: jest.fn(),
      findMany: jest.fn(),
    };
  },
}));

jest.mock('../../lib/mail/mail.service', () => ({
  MailService: class MockMailService {
    isEnabled = jest.fn();
    sendMail = jest.fn();
  },
}));

import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../lib/database/prisma.service';
import { MailService } from '../../lib/mail/mail.service';
import { SupportService } from './support.service';

describe('SupportService', () => {
  let supportService: SupportService;
  let prismaService: PrismaService;
  let mailService: MailService;
  let configService: ConfigService;

  const user = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    fullName: 'Student One',
    email: 'student@example.com',
    phoneNumber: '0599000000',
    telegramUsername: 'student',
    region: 'gaza' as const,
    role: 'student' as const,
    clerkId: 'clerk_student',
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  const createdAt = new Date('2026-07-01T08:00:00.000Z');

  beforeEach(() => {
    prismaService = new PrismaService();
    mailService = new MailService({} as never);
    configService = {
      get: jest.fn().mockReturnValue('teacher@example.com'),
    } as unknown as ConfigService;
    supportService = new SupportService(
      prismaService,
      mailService,
      configService as never,
    );
  });

  it('persists support requests even when teacher notification fails', async () => {
    jest.spyOn(prismaService.supportRequest, 'create').mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440020',
      userId: user.id,
      subject: 'Help',
      message: 'Need help',
      status: 'open',
      adminReply: null,
      reviewedAt: null,
      closedAt: null,
      createdAt,
      updatedAt: createdAt,
    });
    jest.spyOn(mailService, 'isEnabled').mockReturnValue(true);
    jest
      .spyOn(mailService, 'sendMail')
      .mockRejectedValue(new Error('smtp down'));

    await expect(
      supportService.create(user, {
        subject: 'Help',
        message: 'Need help',
      }),
    ).resolves.toMatchObject({
      id: '550e8400-e29b-41d4-a716-446655440020',
      status: 'open',
    });
  });
});
