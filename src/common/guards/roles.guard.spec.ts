jest.mock('../../modules/auth/auth.service', () => ({
  AuthService: class MockAuthService {
    findUserByClerkId = jest.fn();
  },
}));

import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AuthService } from '../../modules/auth/auth.service';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let authService: AuthService;

  const createContext = (clerkUserId?: string): ExecutionContext => {
    const request = {
      clerkUserId,
    } as AuthenticatedRequest;

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as ExecutionContext;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    authService = new AuthService({} as never);
    guard = new RolesGuard(
      reflector as unknown as Reflector,
      authService,
    );
  });

  it('allows public routes', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'isPublic') {
        return true;
      }

      return undefined;
    });

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(authService.findUserByClerkId).not.toHaveBeenCalled();
  });

  it('allows protected routes without role metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(createContext('user_123'))).resolves.toBe(
      true,
    );
    expect(authService.findUserByClerkId).not.toHaveBeenCalled();
  });

  it('rejects routes with an empty Roles decorator', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'roles') {
        return [];
      }

      return false;
    });

    await expect(guard.canActivate(createContext('user_123'))).rejects.toThrow(
      new ForbiddenException('Route requires at least one role'),
    );
    expect(authService.findUserByClerkId).not.toHaveBeenCalled();
  });

  it('propagates database errors instead of masking them as forbidden', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'roles') {
        return ['admin'];
      }

      return false;
    });
    const databaseError = new Error('connection refused');
    authService.findUserByClerkId = jest.fn().mockRejectedValue(databaseError);

    await expect(guard.canActivate(createContext('user_123'))).rejects.toThrow(
      databaseError,
    );
  });

  it('rejects unregistered users on role-protected routes', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'roles') {
        return ['admin'];
      }

      return false;
    });
    authService.findUserByClerkId = jest.fn().mockResolvedValue(null);

    await expect(guard.canActivate(createContext('user_123'))).rejects.toThrow(
      new ForbiddenException('User is not registered'),
    );
  });

  it('rejects users with insufficient permissions', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'roles') {
        return ['admin'];
      }

      return false;
    });
    authService.findUserByClerkId = jest.fn().mockResolvedValue({
      id: 'uuid',
      clerkId: 'user_123',
      email: 'student@example.com',
      fullName: 'Student',
      phoneNumber: '1234567890',
      telegramUsername: 'student',
      region: 'gaza',
      role: 'student',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(guard.canActivate(createContext('user_123'))).rejects.toThrow(
      new ForbiddenException('Insufficient permissions'),
    );
  });

  it('attaches the local user when role checks pass', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'roles') {
        return ['admin'];
      }

      return false;
    });
    const adminUser = {
      id: 'uuid',
      clerkId: 'user_admin',
      email: 'admin@example.com',
      fullName: 'Admin',
      phoneNumber: '1234567890',
      telegramUsername: 'admin',
      region: 'gaza' as const,
      role: 'admin' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    authService.findUserByClerkId = jest.fn().mockResolvedValue(adminUser);
    const context = createContext('user_admin');
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(adminUser);
  });
});
