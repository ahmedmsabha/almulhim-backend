jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    supportRequest = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    };
  },
}));

jest.mock('../../lib/mail/mail.service', () => ({
  MailService: class MockMailService {
    isEnabled = jest.fn();
    sendMail = jest.fn();
  },
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/database/prisma.service';
import { MailService } from '../../lib/mail/mail.service';
import { AdminSupportService } from './admin-support.service';

describe('AdminSupportService', () => {
  let adminSupportService: AdminSupportService;
  let prismaService: PrismaService;
  let mailService: MailService;

  const requestId = '550e8400-e29b-41d4-a716-446655440020';
  const createdAt = new Date('2026-07-01T08:00:00.000Z');

  const student = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    fullName: 'Student One',
    email: 'student@example.com',
    phoneNumber: '0599000000',
    telegramUsername: 'student',
    region: 'gaza' as const,
    role: 'student' as const,
    clerkId: 'clerk_student',
    createdAt,
    updatedAt: createdAt,
  };

  const openRequest = {
    id: requestId,
    userId: student.id,
    subject: 'Help',
    message: 'Need help',
    status: 'open' as const,
    adminReply: null,
    reviewedAt: null,
    closedAt: null,
    createdAt,
    updatedAt: createdAt,
    user: student,
  };

  beforeEach(() => {
    prismaService = new PrismaService();
    mailService = new MailService({} as never);
    adminSupportService = new AdminSupportService(prismaService, mailService);
  });

  it('replies to an open request and marks it reviewed', async () => {
    jest.spyOn(prismaService.supportRequest, 'findUnique').mockResolvedValue(openRequest);
    jest.spyOn(prismaService.supportRequest, 'update').mockResolvedValue({
      ...openRequest,
      status: 'reviewed',
      adminReply: 'We can help',
      reviewedAt: createdAt,
    });
    jest.spyOn(mailService, 'isEnabled').mockReturnValue(false);

    const result = await adminSupportService.reply(requestId, {
      reply: 'We can help',
    });

    expect(result.status).toBe('reviewed');
    expect(result.adminReply).toBe('We can help');
  });

  it('rejects replies to closed requests', async () => {
    jest.spyOn(prismaService.supportRequest, 'findUnique').mockResolvedValue({
      ...openRequest,
      status: 'closed',
      closedAt: createdAt,
    });

    await expect(
      adminSupportService.reply(requestId, { reply: 'Too late' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when request is missing', async () => {
    jest.spyOn(prismaService.supportRequest, 'findUnique').mockResolvedValue(null);

    await expect(
      adminSupportService.getRequest(requestId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
