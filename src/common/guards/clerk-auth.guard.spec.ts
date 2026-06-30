import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkAuthGuard } from './clerk-auth.guard';
import type { ClerkService } from '../../lib/clerk/clerk.service';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';

describe('ClerkAuthGuard', () => {
  let guard: ClerkAuthGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let clerkService: jest.Mocked<Pick<ClerkService, 'verifyBearerToken'>>;

  const createContext = (
    authorizationHeader?: string,
  ): ExecutionContext => {
    const request = {
      headers: {
        authorization: authorizationHeader,
      },
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
    clerkService = {
      verifyBearerToken: jest.fn(),
    };
    guard = new ClerkAuthGuard(
      reflector as unknown as Reflector,
      clerkService as unknown as ClerkService,
    );
  });

  it('allows public routes without a token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(clerkService.verifyBearerToken).not.toHaveBeenCalled();
  });

  it('rejects protected routes without a bearer token', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Missing bearer token'),
    );
  });

  it('attaches clerkUserId when token verification succeeds', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    clerkService.verifyBearerToken.mockResolvedValue({
      sub: 'user_123',
      email: 'student@example.com',
    });
    const context = createContext('Bearer valid_token');
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(clerkService.verifyBearerToken).toHaveBeenCalledWith('valid_token');
    expect(request.clerkUserId).toBe('user_123');
    expect(request.clerkEmail).toBe('student@example.com');
  });

  it('rejects invalid tokens', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    clerkService.verifyBearerToken.mockRejectedValue(new Error('invalid'));
    const context = createContext('Bearer bad_token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired token'),
    );
  });
});
