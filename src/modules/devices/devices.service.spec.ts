jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    deviceBinding = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
  },
}));

jest.mock('../../lib/devices/device-hash.service', () => ({
  DeviceHashService: class MockDeviceHashService {
    hash = jest.fn();
  },
}));

jest.mock('../../lib/analytics/analytics.service', () => ({
  AnalyticsService: class MockAnalyticsService {
    captureDeviceBound = jest.fn();
  },
}));

import { ConflictException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { AnalyticsService } from '../../lib/analytics/analytics.service';
import { PrismaService } from '../../lib/database/prisma.service';
import { DeviceHashService } from '../../lib/devices/device-hash.service';
import { DevicesService } from './devices.service';

describe('DevicesService', () => {
  let devicesService: DevicesService;
  let prismaService: PrismaService;
  let deviceHashService: DeviceHashService;
  let analyticsService: AnalyticsService;

  const user = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    fullName: 'Student One',
    email: 'student@example.com',
    phoneNumber: '0599000000',
    telegramUsername: 'student',
    region: 'gaza' as const,
    role: 'student' as const,
    clerkId: 'clerk_student',
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  const deviceIdentifier = '550e8400-e29b-41d4-a716-446655440000';
  const boundAt = new Date('2026-07-01T08:00:00.000Z');

  beforeEach(() => {
    prismaService = new PrismaService();
    deviceHashService = new DeviceHashService({} as never);
    analyticsService = new AnalyticsService({} as never);
    devicesService = new DevicesService(
      prismaService,
      deviceHashService,
      analyticsService,
    );
    jest.spyOn(deviceHashService, 'hash').mockReturnValue('hashed-device');
    jest.clearAllMocks();
  });

  it('creates a binding when the slot is empty', async () => {
    jest.spyOn(prismaService.deviceBinding, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prismaService.deviceBinding, 'create').mockResolvedValue({
      id: 'binding-id',
      userId: user.id,
      deviceType: 'web',
      deviceHash: 'hashed-device',
      boundAt,
      lastSeenAt: boundAt,
      createdAt: boundAt,
      updatedAt: boundAt,
    });

    await expect(
      devicesService.bind(user, {
        deviceType: 'web',
        deviceIdentifier,
      }),
    ).resolves.toMatchObject({
      deviceType: 'web',
      boundAt: boundAt.toISOString(),
    });
    expect(analyticsService.captureDeviceBound).toHaveBeenCalledWith(user.id, {
      deviceType: 'web',
    });
  });

  it('refreshes lastSeenAt when rebinding the same device', async () => {
    jest.spyOn(prismaService.deviceBinding, 'findUnique').mockResolvedValue({
      id: 'binding-id',
      userId: user.id,
      deviceType: 'mobile',
      deviceHash: 'hashed-device',
      boundAt,
      lastSeenAt: boundAt,
      createdAt: boundAt,
      updatedAt: boundAt,
    });
    jest.spyOn(prismaService.deviceBinding, 'update').mockResolvedValue({
      id: 'binding-id',
      userId: user.id,
      deviceType: 'mobile',
      deviceHash: 'hashed-device',
      boundAt,
      lastSeenAt: new Date('2026-07-01T09:00:00.000Z'),
      createdAt: boundAt,
      updatedAt: boundAt,
    });

    await expect(
      devicesService.bind(user, {
        deviceType: 'mobile',
        deviceIdentifier,
      }),
    ).resolves.toMatchObject({
      deviceType: 'mobile',
      lastSeenAt: '2026-07-01T09:00:00.000Z',
    });
    expect(analyticsService.captureDeviceBound).not.toHaveBeenCalled();
  });

  it('handles concurrent bind create races idempotently', async () => {
    jest.spyOn(prismaService.deviceBinding, 'findUnique')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'binding-id',
        userId: user.id,
        deviceType: 'web',
        deviceHash: 'hashed-device',
        boundAt,
        lastSeenAt: boundAt,
        createdAt: boundAt,
        updatedAt: boundAt,
      });
    jest.spyOn(prismaService.deviceBinding, 'create').mockRejectedValue(
      new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['user_id', 'device_type'] },
      }),
    );
    jest.spyOn(prismaService.deviceBinding, 'update').mockResolvedValue({
      id: 'binding-id',
      userId: user.id,
      deviceType: 'web',
      deviceHash: 'hashed-device',
      boundAt,
      lastSeenAt: new Date('2026-07-01T09:00:00.000Z'),
      createdAt: boundAt,
      updatedAt: boundAt,
    });

    await expect(
      devicesService.bind(user, {
        deviceType: 'web',
        deviceIdentifier,
      }),
    ).resolves.toMatchObject({
      deviceType: 'web',
      lastSeenAt: '2026-07-01T09:00:00.000Z',
    });
  });

  it('throws ConflictException when another device already owns the slot', async () => {
    jest.spyOn(prismaService.deviceBinding, 'findUnique').mockResolvedValue({
      id: 'binding-id',
      userId: user.id,
      deviceType: 'web',
      deviceHash: 'different-hash',
      boundAt,
      lastSeenAt: boundAt,
      createdAt: boundAt,
      updatedAt: boundAt,
    });

    await expect(
      devicesService.bind(user, {
        deviceType: 'web',
        deviceIdentifier,
      }),
    ).rejects.toThrow(
      new ConflictException(
        'This device type is already bound to another device',
      ),
    );
  });

  it('returns slot status for both device types', async () => {
    jest.spyOn(prismaService.deviceBinding, 'findMany').mockResolvedValue([
      {
        id: 'binding-id',
        userId: user.id,
        deviceType: 'web',
        deviceHash: 'hashed-device',
        boundAt,
        lastSeenAt: boundAt,
        createdAt: boundAt,
        updatedAt: boundAt,
      },
    ]);

    await expect(devicesService.getStatus(user)).resolves.toEqual({
      web: {
        bound: true,
        boundAt: boundAt.toISOString(),
        lastSeenAt: boundAt.toISOString(),
      },
      mobile: {
        bound: false,
        boundAt: null,
        lastSeenAt: null,
      },
    });
  });
});
