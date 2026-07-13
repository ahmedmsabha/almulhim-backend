jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    user = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    };
    $queryRaw = jest.fn();
  },
}));

jest.mock('../../lib/analytics/analytics.service', () => ({
  AnalyticsService: class MockAnalyticsService {
    captureUserRegistered = jest.fn();
  },
}));

jest.mock('../../lib/clerk/clerk.service', () => ({
  ClerkService: class MockClerkService {
    banUser = jest.fn();
    unbanUser = jest.fn();
    deleteUser = jest.fn();
  },
}));

import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { AnalyticsService } from '../../lib/analytics/analytics.service';
import { ClerkService } from '../../lib/clerk/clerk.service';
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
  let analyticsService: AnalyticsService;
  let clerkService: ClerkService;

  const studentUser = {
    id: 'uuid-1',
    clerkId: 'user_123',
    email: 'student@example.com',
    fullName: 'Student Name',
    phoneNumber: '0599000000',
    telegramUsername: 'student_tg',
    region: 'gaza' as const,
    role: 'student' as const,
    deactivatedAt: null as Date | null,
    createdAt: new Date('2026-06-30T10:00:00.000Z'),
    updatedAt: new Date('2026-06-30T10:00:00.000Z'),
  };

  const studentListRow = {
    ...studentUser,
    subscriptions: [{ status: 'active' as const }],
  };

  const listItem = {
    id: studentUser.id,
    clerkId: studentUser.clerkId,
    fullName: studentUser.fullName,
    email: studentUser.email,
    phone: studentUser.phoneNumber,
    telegram: studentUser.telegramUsername,
    region: studentUser.region,
    subscriptionStatus: 'active' as const,
    deactivatedAt: null,
  };

  beforeEach(() => {
    prismaService = new PrismaService({} as never);
    analyticsService = new AnalyticsService({} as never);
    clerkService = new ClerkService({} as never);
    usersService = new UsersService(
      prismaService,
      analyticsService,
      clerkService,
    );
    jest.clearAllMocks();
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

    it('throws ForbiddenException when the student is deactivated', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
        ...studentUser,
        deactivatedAt: new Date('2026-07-12T10:00:00.000Z'),
      });

      await expect(usersService.getCurrentUser('user_123')).rejects.toThrow(
        new ForbiddenException('Student account is deactivated'),
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
            ...registerInput,
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
          fullName: registerInput.fullName,
          phoneNumber: registerInput.phoneNumber,
          telegramUsername: registerInput.telegramUsername,
          region: registerInput.region,
          role: 'student',
        },
      });
      expect(analyticsService.captureUserRegistered).toHaveBeenCalledWith(
        studentUser.id,
        { region: 'gaza' },
      );
    });

    it('updates an existing student profile when clerkId already exists', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(studentUser);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue({
        ...studentUser,
        fullName: 'Updated Name',
      });

      await expect(
        usersService.registerUser({
          clerkId: 'user_123',
          email: 'student@example.com',
          input: {
            ...registerInput,
            fullName: 'Updated Name',
          },
        }),
      ).resolves.toMatchObject({ fullName: 'Updated Name' });

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { clerkId: 'user_123' },
        data: {
          email: 'student@example.com',
          fullName: 'Updated Name',
          phoneNumber: registerInput.phoneNumber,
          telegramUsername: registerInput.telegramUsername,
          region: registerInput.region,
        },
      });
      expect(analyticsService.captureUserRegistered).not.toHaveBeenCalled();
    });

    it('rejects registration updates when the student is deactivated', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
        ...studentUser,
        deactivatedAt: new Date('2026-07-12T10:00:00.000Z'),
      });

      await expect(
        usersService.registerUser({
          clerkId: 'user_123',
          email: 'student@example.com',
          input: registerInput,
        }),
      ).rejects.toThrow(
        new ForbiddenException('Student account is deactivated'),
      );
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('throws ZodError for invalid input', async () => {
      await expect(
        usersService.registerUser({
          clerkId: 'user_123',
          email: 'student@example.com',
          input: {},
        }),
      ).rejects.toBeInstanceOf(ZodError);
    });

    it('maps unique constraint violations to ConflictException', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'create').mockRejectedValue(
        new PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
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
    it('returns a paginated student list with defaults when no params are provided', async () => {
      jest.spyOn(prismaService.user, 'count').mockResolvedValue(1);
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([studentListRow]);

      await expect(usersService.listStudents()).resolves.toEqual({
        students: [listItem],
        total: 1,
        page: 1,
        pageSize: 10,
      });

      expect(prismaService.user.count).toHaveBeenCalledWith({
        where: { role: 'student', deactivatedAt: null },
      });
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: { role: 'student', deactivatedAt: null },
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(prismaService.$queryRaw).not.toHaveBeenCalled();
    });

    it('excludes deactivated students by default', async () => {
      jest.spyOn(prismaService.user, 'count').mockResolvedValue(0);
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([]);

      await usersService.listStudents({});

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'student',
            deactivatedAt: null,
          }),
        }),
      );
    });

    it('includes deactivated students when includeDeactivated=true', async () => {
      const deactivatedRow = {
        ...studentListRow,
        deactivatedAt: new Date('2026-07-12T10:00:00.000Z'),
      };
      jest.spyOn(prismaService.user, 'count').mockResolvedValue(1);
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([deactivatedRow]);

      await expect(
        usersService.listStudents({ includeDeactivated: 'true' }),
      ).resolves.toEqual({
        students: [
          {
            ...listItem,
            deactivatedAt: '2026-07-12T10:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      });

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'student' },
        }),
      );
    });

    it('applies case-insensitive search across name, email, phone, and telegram', async () => {
      jest.spyOn(prismaService.user, 'count').mockResolvedValue(1);
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([studentListRow]);

      await usersService.listStudents({ q: 'Sara' });

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: 'student',
            deactivatedAt: null,
            OR: [
              { fullName: { contains: 'Sara', mode: 'insensitive' } },
              { email: { contains: 'Sara', mode: 'insensitive' } },
              { phoneNumber: { contains: 'Sara', mode: 'insensitive' } },
              { telegramUsername: { contains: 'Sara', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('filters by region', async () => {
      jest.spyOn(prismaService.user, 'count').mockResolvedValue(1);
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([studentListRow]);

      await usersService.listStudents({ region: 'gaza' });

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: 'student',
            deactivatedAt: null,
            region: 'gaza',
          },
        }),
      );
    });

    it('filters free students with no subscription rows', async () => {
      const freeRow = { ...studentUser, subscriptions: [] };
      jest.spyOn(prismaService.user, 'count').mockResolvedValue(1);
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([freeRow]);

      await expect(
        usersService.listStudents({ status: 'free' }),
      ).resolves.toEqual({
        students: [
          {
            ...listItem,
            subscriptionStatus: 'free',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      });

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: 'student',
            deactivatedAt: null,
            subscriptions: { none: {} },
          },
        }),
      );
      expect(prismaService.$queryRaw).not.toHaveBeenCalled();
    });

    it('filters by latest subscription status via SQL', async () => {
      jest
        .spyOn(prismaService, '$queryRaw')
        .mockResolvedValue([{ id: studentUser.id }]);
      jest.spyOn(prismaService.user, 'count').mockResolvedValue(1);
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([studentListRow]);

      await usersService.listStudents({ status: 'active' });

      expect(prismaService.$queryRaw).toHaveBeenCalled();
      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: 'student',
            deactivatedAt: null,
            id: { in: [studentUser.id] },
          },
        }),
      );
    });

    it('applies pagination skip/take and returns total after filters', async () => {
      jest.spyOn(prismaService.user, 'count').mockResolvedValue(25);
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([studentListRow]);

      await expect(
        usersService.listStudents({ page: '2', pageSize: '5' }),
      ).resolves.toEqual({
        students: [listItem],
        total: 25,
        page: 2,
        pageSize: 5,
      });

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        }),
      );
    });

    it('returns an empty page when no students match', async () => {
      jest.spyOn(prismaService.user, 'count').mockResolvedValue(0);
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue([]);

      await expect(
        usersService.listStudents({ q: 'nobody' }),
      ).resolves.toEqual({
        students: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });
    });

    it('throws ZodError for invalid query values', async () => {
      await expect(
        usersService.listStudents({ status: 'not-a-status', page: '0' }),
      ).rejects.toBeInstanceOf(ZodError);
    });
  });

  describe('getStudentById', () => {
    it('returns the student list-row DTO with subscription status', async () => {
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(studentListRow);

      await expect(
        usersService.getStudentById(studentUser.id),
      ).resolves.toEqual(listItem);

      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: studentUser.id,
          role: 'student',
        },
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true },
          },
        },
      });
    });

    it('returns subscriptionStatus free when the student has no subscriptions', async () => {
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue({
        ...studentUser,
        subscriptions: [],
      });

      await expect(
        usersService.getStudentById(studentUser.id),
      ).resolves.toEqual({
        ...listItem,
        subscriptionStatus: 'free',
      });
    });

    it('throws NotFoundException when the user id does not exist', async () => {
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);

      await expect(
        usersService.getStudentById('00000000-0000-0000-0000-000000000099'),
      ).rejects.toThrow(new NotFoundException('Student not found'));
    });

    it('throws NotFoundException when the user is an admin', async () => {
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);

      await expect(
        usersService.getStudentById(studentUser.id),
      ).rejects.toThrow(new NotFoundException('Student not found'));

      expect(prismaService.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: studentUser.id,
            role: 'student',
          },
        }),
      );
    });
  });

  describe('deactivateStudent', () => {
    it('sets deactivatedAt and bans the Clerk user', async () => {
      const deactivatedAt = new Date('2026-07-12T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(deactivatedAt);

      jest
        .spyOn(prismaService.user, 'findFirst')
        .mockResolvedValueOnce(studentUser)
        .mockResolvedValueOnce({
          ...studentListRow,
          deactivatedAt,
        });
      jest.spyOn(prismaService.user, 'update').mockResolvedValue({
        ...studentUser,
        deactivatedAt,
      });
      jest.spyOn(clerkService, 'banUser').mockResolvedValue(undefined);

      await expect(
        usersService.deactivateStudent(studentUser.id),
      ).resolves.toEqual({
        ...listItem,
        deactivatedAt: deactivatedAt.toISOString(),
      });

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: studentUser.id },
        data: { deactivatedAt },
      });
      expect(clerkService.banUser).toHaveBeenCalledWith(studentUser.clerkId);

      jest.useRealTimers();
    });

    it('rolls back Nest deactivatedAt when Clerk ban fails', async () => {
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(studentUser);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(studentUser);
      jest
        .spyOn(clerkService, 'banUser')
        .mockRejectedValue(new Error('clerk down'));

      await expect(
        usersService.deactivateStudent(studentUser.id),
      ).rejects.toThrow(
        new BadGatewayException(
          'Failed to ban Clerk user; student was not deactivated',
        ),
      );

      expect(prismaService.user.update).toHaveBeenNthCalledWith(1, {
        where: { id: studentUser.id },
        data: { deactivatedAt: expect.any(Date) },
      });
      expect(prismaService.user.update).toHaveBeenNthCalledWith(2, {
        where: { id: studentUser.id },
        data: { deactivatedAt: null },
      });
    });

    it('is idempotent when already deactivated', async () => {
      const deactivatedAt = new Date('2026-07-12T10:00:00.000Z');
      jest
        .spyOn(prismaService.user, 'findFirst')
        .mockResolvedValueOnce({ ...studentUser, deactivatedAt })
        .mockResolvedValueOnce({
          ...studentListRow,
          deactivatedAt,
        });

      await expect(
        usersService.deactivateStudent(studentUser.id),
      ).resolves.toEqual({
        ...listItem,
        deactivatedAt: deactivatedAt.toISOString(),
      });

      expect(clerkService.banUser).not.toHaveBeenCalled();
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('cannot target an admin (404)', async () => {
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);

      await expect(
        usersService.deactivateStudent(studentUser.id),
      ).rejects.toThrow(new NotFoundException('Student not found'));
      expect(clerkService.banUser).not.toHaveBeenCalled();
    });
  });

  describe('reactivateStudent', () => {
    it('clears deactivatedAt after Clerk unban', async () => {
      const deactivatedAt = new Date('2026-07-12T10:00:00.000Z');
      jest
        .spyOn(prismaService.user, 'findFirst')
        .mockResolvedValueOnce({ ...studentUser, deactivatedAt })
        .mockResolvedValueOnce(studentListRow);
      jest.spyOn(clerkService, 'unbanUser').mockResolvedValue(undefined);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(studentUser);

      await expect(
        usersService.reactivateStudent(studentUser.id),
      ).resolves.toEqual(listItem);

      expect(clerkService.unbanUser).toHaveBeenCalledWith(studentUser.clerkId);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: studentUser.id },
        data: { deactivatedAt: null },
      });
    });

    it('keeps Nest deactivated when Clerk unban fails', async () => {
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue({
        ...studentUser,
        deactivatedAt: new Date('2026-07-12T10:00:00.000Z'),
      });
      jest
        .spyOn(clerkService, 'unbanUser')
        .mockRejectedValue(new Error('clerk down'));

      await expect(
        usersService.reactivateStudent(studentUser.id),
      ).rejects.toThrow(
        new BadGatewayException(
          'Failed to unban Clerk user; student remains deactivated',
        ),
      );
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteStudent', () => {
    it('cascades Nest delete then deletes the Clerk user', async () => {
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(studentUser);
      jest.spyOn(prismaService.user, 'delete').mockResolvedValue(studentUser);
      jest.spyOn(clerkService, 'deleteUser').mockResolvedValue(undefined);

      await expect(
        usersService.deleteStudent(studentUser.id),
      ).resolves.toEqual({
        deleted: true,
        userId: studentUser.id,
      });

      expect(prismaService.user.delete).toHaveBeenCalledWith({
        where: { id: studentUser.id },
      });
      expect(clerkService.deleteUser).toHaveBeenCalledWith(studentUser.clerkId);
    });

    it('returns 502 when Nest delete succeeds but Clerk delete fails', async () => {
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(studentUser);
      jest.spyOn(prismaService.user, 'delete').mockResolvedValue(studentUser);
      jest
        .spyOn(clerkService, 'deleteUser')
        .mockRejectedValue(new Error('clerk down'));

      await expect(usersService.deleteStudent(studentUser.id)).rejects.toThrow(
        new BadGatewayException(
          `Student deleted locally but Clerk user deletion failed (clerkId=${studentUser.clerkId}); manual cleanup required`,
        ),
      );
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('cannot delete an admin (404)', async () => {
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);

      await expect(
        usersService.deleteStudent(studentUser.id),
      ).rejects.toThrow(new NotFoundException('Student not found'));
      expect(prismaService.user.delete).not.toHaveBeenCalled();
    });
  });
});
