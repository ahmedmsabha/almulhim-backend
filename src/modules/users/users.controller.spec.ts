jest.mock('./users.service', () => ({
  UsersService: class MockUsersService {},
}));

import { BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let usersController: UsersController;
  let usersService: jest.Mocked<
    Pick<UsersService, 'getCurrentUser' | 'registerUser' | 'listStudents'>
  >;

  const profile = {
    id: 'uuid-1',
    email: 'student@example.com',
    fullName: 'Student Name',
    phoneNumber: '0599000000',
    telegramUsername: 'student_tg',
    region: 'gaza' as const,
    role: 'student' as const,
    createdAt: '2026-06-30T10:00:00.000Z',
    updatedAt: '2026-06-30T10:00:00.000Z',
  };

  beforeEach(() => {
    usersService = {
      getCurrentUser: jest.fn(),
      registerUser: jest.fn(),
      listStudents: jest.fn(),
    };
    usersController = new UsersController(
      usersService as unknown as UsersService,
    );
  });

  it('delegates getCurrentUser to the service', async () => {
    usersService.getCurrentUser.mockResolvedValue(profile);

    await expect(usersController.getCurrentUser('user_123')).resolves.toEqual(
      profile,
    );
    expect(usersService.getCurrentUser).toHaveBeenCalledWith('user_123');
  });

  it('delegates registerUser to the service', async () => {
    usersService.registerUser.mockResolvedValue(profile);

    await expect(
      usersController.registerUser('user_123', 'student@example.com', {
        fullName: 'Student Name',
        phoneNumber: '0599000000',
        telegramUsername: 'student_tg',
        region: 'gaza',
      }),
    ).resolves.toEqual(profile);

    expect(usersService.registerUser).toHaveBeenCalledWith({
      clerkId: 'user_123',
      email: 'student@example.com',
      input: {
        fullName: 'Student Name',
        phoneNumber: '0599000000',
        telegramUsername: 'student_tg',
        region: 'gaza',
      },
    });
  });

  it('maps Zod validation errors to BadRequestException', async () => {
    usersService.registerUser.mockRejectedValue(
      new ZodError([
        {
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Required',
          path: ['fullName'],
        },
      ]),
    );

    await expect(
      usersController.registerUser('user_123', 'student@example.com', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delegates listStudents to the service', async () => {
    usersService.listStudents.mockResolvedValue({ students: [profile] });

    await expect(usersController.listStudents()).resolves.toEqual({
      students: [profile],
    });
  });
});
