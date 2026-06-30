jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    user = {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    };
  },
}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../../lib/database/prisma.service';
import { UsersService } from './users.service';

const registerInput = {
  fullName: 'Student Name',
  phoneNumber: '0599000000',
  telegramUsername: 'student_tg',
  region: 'gaza' as const,
};

describe('UsersService', () => {
  let usersService: UsersService;
  let prismaService: PrismaService;

  const studentUser = {
    id: 'uuid-1',
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

  beforeEach(() => {
    prismaService = new PrismaService({} as never);
    usersService = new UsersService(prismaService);
  });

  describe('getCurrentUser', () => {
    it('returns the registered user profile', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(studentUser);

      await expect(usersService.getCurrentUser('user_123')).resolves.toEqual({
        id: studentUser.id,
        email: studentUser.email,
        fullName: studentUser.fullName,
        phoneNumber: studentUser.phoneNumber,
        telegramUsername: studentUser.telegramUsername,
        region: studentUser.region,
        role: studentUser.role,
        createdAt: studentUser.createdAt.toISOString(),
        updatedAt: studentUser.updatedAt.toISOString(),
      });
    });

    it('throws NotFoundException when user is not registered', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      await expect(usersService.getCurrentUser('user_123')).rejects.toThrow(
        new NotFoundException('User is not registered'),
      );
    });
  });

  describe('registerUser', () => {
    it('creates a student user from validated input', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValue(studentUser);

      await expect(
        usersService.registerUser({
          clerkId: 'user_123',
          email: 'student@example.com',
          input: {
            fullName: 'Student Name',
            phoneNumber: '0599000000',
            telegramUsername: 'student_tg',
            region: 'gaza',
          },
        }),
      ).resolves.toEqual({
        id: studentUser.id,
        email: studentUser.email,
        fullName: studentUser.fullName,
        phoneNumber: studentUser.phoneNumber,
        telegramUsername: studentUser.telegramUsername,
        region: studentUser.region,
        role: studentUser.role,
        createdAt: studentUser.createdAt.toISOString(),
        updatedAt: studentUser.updatedAt.toISOString(),
      });

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          clerkId: 'user_123',
          email: 'student@example.com',
          fullName: 'Student Name',
          phoneNumber: '0599000000',
          telegramUsername: 'student_tg',
          region: 'gaza',
          role: 'student',
        },
      });
    });

    it('throws ConflictException when user is already registered', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(studentUser);

      await expect(
        usersService.registerUser({
          clerkId: 'user_123',
          email: 'student@example.com',
          input: registerInput,
        }),
      ).rejects.toThrow(new ConflictException('User is already registered'));
    });

    it('throws ConflictException when create hits a unique constraint', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'create').mockRejectedValue(
        new PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.8.0',
        }),
      );

      await expect(
        usersService.registerUser({
          clerkId: 'user_123',
          email: 'student@example.com',
          input: registerInput,
        }),
      ).rejects.toThrow(new ConflictException('User is already registered'));
    });
  });

  describe('listStudents', () => {
    it('returns students ordered by createdAt desc', async () => {
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([studentUser]);

      await expect(usersService.listStudents()).resolves.toEqual({
        students: [
          {
            id: studentUser.id,
            email: studentUser.email,
            fullName: studentUser.fullName,
            phoneNumber: studentUser.phoneNumber,
            telegramUsername: studentUser.telegramUsername,
            region: studentUser.region,
            role: studentUser.role,
            createdAt: studentUser.createdAt.toISOString(),
            updatedAt: studentUser.updatedAt.toISOString(),
          },
        ],
      });

      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: { role: 'student' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
