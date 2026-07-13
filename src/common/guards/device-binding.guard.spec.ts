jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    deviceBinding = {
      findUnique: jest.fn(),
    };
  },
}));

jest.mock('../../lib/devices/device-hash.service', () => ({
  DeviceHashService: class MockDeviceHashService {
    hash = jest.fn();
  },
}));

import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { DeviceBindingGuard } from './device-binding.guard';
import { PrismaService } from '../../lib/database/prisma.service';
import { DeviceHashService } from '../../lib/devices/device-hash.service';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';

describe('DeviceBindingGuard', () => {
  let guard: DeviceBindingGuard;
  let prismaService: PrismaService;
  let deviceHashService: DeviceHashService;

  const studentUser = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clerkId: 'user_123',
    email: 'student@example.com',
    fullName: 'Student',
    phoneNumber: '0599000000',
    telegramUsername: 'student_tg',
    region: 'gaza' as const,
    role: 'student' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const deviceIdentifier = '550e8400-e29b-41d4-a716-446655440000';

  const createContext = (request: Partial<AuthenticatedRequest>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as ExecutionContext;

  beforeEach(() => {
    prismaService = new PrismaService();
    deviceHashService = new DeviceHashService({} as never);
    guard = new DeviceBindingGuard(prismaService, deviceHashService);
    jest.spyOn(deviceHashService, 'hash').mockReturnValue('hashed-device');
  });

  it('allows requests when the presented device matches the stored binding', async () => {
    jest.spyOn(prismaService.deviceBinding, 'findUnique').mockResolvedValue({
      id: 'binding-id',
      userId: studentUser.id,
      deviceType: 'web',
      deviceHash: 'hashed-device',
      boundAt: new Date(),
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = {
      user: studentUser,
      headers: {
        'x-device-id': deviceIdentifier,
        'x-device-type': 'web',
      },
    } as AuthenticatedRequest;

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.device).toEqual({
      deviceType: 'web',
      deviceIdentifier,
      deviceHash: 'hashed-device',
    });
  });

  it('throws UnauthorizedException when request.user is missing', async () => {
    await expect(
      guard.canActivate(
        createContext({
          headers: {
            'x-device-id': deviceIdentifier,
            'x-device-type': 'web',
          },
        }),
      ),
    ).rejects.toThrow(new UnauthorizedException('Authentication required'));
  });

  it('throws ForbiddenException when no binding exists', async () => {
    jest.spyOn(prismaService.deviceBinding, 'findUnique').mockResolvedValue(null);

    await expect(
      guard.canActivate(
        createContext({
          user: studentUser,
          headers: {
            'x-device-id': deviceIdentifier,
            'x-device-type': 'mobile',
          },
        }),
      ),
    ).rejects.toThrow(
      new ForbiddenException('Device is not bound for this device type'),
    );
  });

  it('throws ForbiddenException when the device hash does not match', async () => {
    jest.spyOn(prismaService.deviceBinding, 'findUnique').mockResolvedValue({
      id: 'binding-id',
      userId: studentUser.id,
      deviceType: 'web',
      deviceHash: 'different-hash',
      boundAt: new Date(),
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      guard.canActivate(
        createContext({
          user: studentUser,
          headers: {
            'x-device-id': deviceIdentifier,
            'x-device-type': 'web',
          },
        }),
      ),
    ).rejects.toThrow(new ForbiddenException('Device binding mismatch'));
  });
});
