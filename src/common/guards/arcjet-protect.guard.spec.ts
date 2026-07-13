jest.mock('../../lib/arcjet/arcjet.service', () => ({
  ArcjetService: class MockArcjetService {
    isEnabled = jest.fn();
    protectProfile = jest.fn();
  },
}));

import {
  ExecutionContext,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ArcjetProtectGuard } from './arcjet-protect.guard';
import { ArcjetService } from '../../lib/arcjet/arcjet.service';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';

describe('ArcjetProtectGuard', () => {
  let guard: ArcjetProtectGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'get'>>;
  let arcjetService: jest.Mocked<
    Pick<ArcjetService, 'isEnabled' | 'protectProfile'>
  >;

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
    reflector = { get: jest.fn() };
    arcjetService = {
      isEnabled: jest.fn(),
      protectProfile: jest.fn(),
    };
    guard = new ArcjetProtectGuard(
      reflector as unknown as Reflector,
      arcjetService as unknown as ArcjetService,
    );
  });

  it('allows requests when no profile metadata is set', async () => {
    reflector.get.mockReturnValue(undefined);

    await expect(
      guard.canActivate(createContext({})),
    ).resolves.toBe(true);
    expect(arcjetService.protectProfile).not.toHaveBeenCalled();
  });

  it('allows requests when Arcjet is disabled', async () => {
    reflector.get.mockReturnValue('support-create');
    arcjetService.isEnabled.mockReturnValue(false);

    await expect(
      guard.canActivate(createContext({ clerkUserId: 'user_123' })),
    ).resolves.toBe(true);
    expect(arcjetService.protectProfile).not.toHaveBeenCalled();
  });

  it('passes clerkUserId as userId to Arcjet', async () => {
    reflector.get.mockReturnValue('support-create');
    arcjetService.isEnabled.mockReturnValue(true);
    arcjetService.protectProfile.mockResolvedValue({
      isDenied: () => false,
      isErrored: () => false,
    } as never);

    const request = { clerkUserId: 'user_123' };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(arcjetService.protectProfile).toHaveBeenCalledWith(
      'support-create',
      request,
      { userId: 'user_123' },
    );
  });

  it('throws 429 when Arcjet denies for rate limit', async () => {
    reflector.get.mockReturnValue('receipt-submit');
    arcjetService.isEnabled.mockReturnValue(true);
    arcjetService.protectProfile.mockResolvedValue({
      isDenied: () => true,
      isErrored: () => false,
      reason: {
        isRateLimit: () => true,
      },
    } as never);

    await expect(
      guard.canActivate(createContext({ clerkUserId: 'user_123' })),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });

  it('throws 403 when Arcjet denies for non-rate-limit reasons', async () => {
    reflector.get.mockReturnValue('device-bind');
    arcjetService.isEnabled.mockReturnValue(true);
    arcjetService.protectProfile.mockResolvedValue({
      isDenied: () => true,
      isErrored: () => false,
      reason: {
        isRateLimit: () => false,
      },
    } as never);

    await expect(
      guard.canActivate(createContext({ clerkUserId: 'user_123' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails open when Arcjet returns an errored decision', async () => {
    reflector.get.mockReturnValue('download-authorize');
    arcjetService.isEnabled.mockReturnValue(true);
    arcjetService.protectProfile.mockResolvedValue({
      isDenied: () => false,
      isErrored: () => true,
    } as never);

    await expect(
      guard.canActivate(createContext({ clerkUserId: 'user_123' })),
    ).resolves.toBe(true);
  });
});
