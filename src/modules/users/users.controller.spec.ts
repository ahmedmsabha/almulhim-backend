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
    Pick<
      UsersService,
      | 'getCurrentUser'
      | 'registerUser'
      | 'listStudents'
      | 'getStudentById'
      | 'deactivateStudent'
      | 'reactivateStudent'
      | 'deleteStudent'
    >
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

  const studentListResponse = {
    students: [
      {
        id: 'uuid-1',
        clerkId: 'user_123',
        fullName: 'Student Name',
        email: 'student@example.com',
        phone: '0599000000',
        telegram: 'student_tg',
        region: 'gaza' as const,
        subscriptionStatus: 'active' as const,
        deactivatedAt: null,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 10,
  };

  beforeEach(() => {
    usersService = {
      getCurrentUser: jest.fn(),
      registerUser: jest.fn(),
      listStudents: jest.fn(),
      getStudentById: jest.fn(),
      deactivateStudent: jest.fn(),
      reactivateStudent: jest.fn(),
      deleteStudent: jest.fn(),
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

  it('maps Zod validation errors to BadRequestException on register', async () => {
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

  it('delegates listStudents query params to the service', async () => {
    usersService.listStudents.mockResolvedValue(studentListResponse);

    const query = {
      q: 'sara',
      region: 'gaza',
      status: 'active',
      includeDeactivated: 'true',
      page: '1',
      pageSize: '10',
    };

    await expect(usersController.listStudents(query)).resolves.toEqual(
      studentListResponse,
    );
    expect(usersService.listStudents).toHaveBeenCalledWith(query);
  });

  it('maps Zod validation errors to BadRequestException on listStudents', async () => {
    usersService.listStudents.mockRejectedValue(
      new ZodError([
        {
          code: 'invalid_enum_value',
          options: ['gaza', 'west_bank'],
          received: 'north',
          message: 'Invalid enum value',
          path: ['region'],
        },
      ]),
    );

    await expect(
      usersController.listStudents({ region: 'north' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delegates getStudent to the service', async () => {
    const student = studentListResponse.students[0];
    usersService.getStudentById.mockResolvedValue(student);

    await expect(usersController.getStudent(student.id)).resolves.toEqual(
      student,
    );
    expect(usersService.getStudentById).toHaveBeenCalledWith(student.id);
  });

  it('delegates deactivateStudent to the service', async () => {
    const student = {
      ...studentListResponse.students[0],
      deactivatedAt: '2026-07-12T12:00:00.000Z',
    };
    usersService.deactivateStudent.mockResolvedValue(student);

    await expect(
      usersController.deactivateStudent(student.id),
    ).resolves.toEqual(student);
    expect(usersService.deactivateStudent).toHaveBeenCalledWith(student.id);
  });

  it('delegates reactivateStudent to the service', async () => {
    const student = studentListResponse.students[0];
    usersService.reactivateStudent.mockResolvedValue(student);

    await expect(
      usersController.reactivateStudent(student.id),
    ).resolves.toEqual(student);
    expect(usersService.reactivateStudent).toHaveBeenCalledWith(student.id);
  });

  it('delegates deleteStudent to the service', async () => {
    usersService.deleteStudent.mockResolvedValue({
      deleted: true,
      userId: 'uuid-1',
    });

    await expect(usersController.deleteStudent('uuid-1')).resolves.toEqual({
      deleted: true,
      userId: 'uuid-1',
    });
    expect(usersService.deleteStudent).toHaveBeenCalledWith('uuid-1');
  });
});
