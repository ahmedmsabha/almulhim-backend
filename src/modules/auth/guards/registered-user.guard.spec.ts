jest.mock('../auth.service', () => ({
  AuthService: class MockAuthService {
    findUserByClerkId = jest.fn();
  },
}));

import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthService } from '../auth.service';
import type { AuthenticatedRequest } from '../../../common/types/authenticated-request.type';
import { RegisteredUserGuard } from './registered-user.guard';

describe('RegisteredUserGuard', () => {
  let guard: RegisteredUserGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let authService: jest.Mocked<Pick<AuthService, 'findUserByClerkId'>>;

  const studentUser = {
    id: 'uuid-1',
    clerkId: 'user_123',
    email: 'student@example.com',
    fullName: 'Student',
    phoneNumber: '0599000000',
    telegramUsername: 'student_tg',
    region: 'gaza' as const,
    role: 'student' as const,
    deactivatedAt: null as Date | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createContext = (
    request: Partial<AuthenticatedRequest>,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    authService = { findUserByClerkId: jest.fn() };
    guard = new RegisteredUserGuard(
      reflector as unknown as Reflector,
      authService as unknown as AuthService,
    );
  });

  it('allows routes without registration requirement', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'isPublic') return false;
      if (key === 'requiresRegistration') return false;
      return undefined;
    });

    await expect(
      guard.canActivate(createContext({ clerkUserId: 'user_123' })),
    ).resolves.toBe(true);
    expect(authService.findUserByClerkId).not.toHaveBeenCalled();
  });

  it('loads the user and attaches request.user for registration-required routes', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'isPublic') return false;
      if (key === 'requiresRegistration') return true;
      if (key === 'studentOnly') return false;
      return undefined;
    });
    authService.findUserByClerkId.mockResolvedValue(studentUser);
    const request = { clerkUserId: 'user_123' } as AuthenticatedRequest;

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual(studentUser);
  });

  it('throws NotFoundException when the user is not registered', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'isPublic') return false;
      if (key === 'requiresRegistration') return true;
      return undefined;
    });
    authService.findUserByClerkId.mockResolvedValue(null);

    await expect(
      guard.canActivate(createContext({ clerkUserId: 'user_123' })),
    ).rejects.toThrow(new NotFoundException('User is not registered'));
  });

  it('throws ForbiddenException when the student is deactivated', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'isPublic') return false;
      if (key === 'requiresRegistration') return true;
      if (key === 'studentOnly') return false;
      return undefined;
    });
    authService.findUserByClerkId.mockResolvedValue({
      ...studentUser,
      deactivatedAt: new Date('2026-07-12T10:00:00.000Z'),
    });

    await expect(
      guard.canActivate(createContext({ clerkUserId: 'user_123' })),
    ).rejects.toThrow(new ForbiddenException('Student account is deactivated'));
  });

  it('throws ForbiddenException for student-only routes when role is admin', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'isPublic') return false;
      if (key === 'requiresRegistration') return true;
      if (key === 'studentOnly') return true;
      return undefined;
    });
    authService.findUserByClerkId.mockResolvedValue({
      ...studentUser,
      role: 'admin',
    });

    await expect(
      guard.canActivate(createContext({ clerkUserId: 'admin_123' })),
    ).rejects.toThrow(new ForbiddenException('Student account required'));
  });

  it('reuses request.user when already populated', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'isPublic') return false;
      if (key === 'requiresRegistration') return true;
      if (key === 'studentOnly') return false;
      return undefined;
    });

    const request = {
      clerkUserId: 'user_123',
      user: studentUser,
    } as AuthenticatedRequest;

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(authService.findUserByClerkId).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when clerkUserId is missing', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'isPublic') return false;
      if (key === 'requiresRegistration') return true;
      return undefined;
    });

    await expect(guard.canActivate(createContext({}))).rejects.toThrow(
      new UnauthorizedException('Authentication required'),
    );
  });
});
