jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    user = {
      findUnique: jest.fn(),
    };
    deviceBinding = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    };
  },
}));

jest.mock('../downloads/downloads.service', () => ({
  DownloadsService: class MockDownloadsService {
    revokeDownloads = jest.fn();
  },
}));

jest.mock('../../lib/analytics/analytics.service', () => ({
  AnalyticsService: class MockAnalyticsService {
    captureDeviceReset = jest.fn();
  },
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnalyticsService } from '../../lib/analytics/analytics.service';
import { PrismaService } from '../../lib/database/prisma.service';
import { DownloadsService } from '../downloads/downloads.service';
import { AdminDevicesService } from './admin-devices.service';

describe('AdminDevicesService', () => {
  let adminDevicesService: AdminDevicesService;
  let prismaService: PrismaService;
  let downloadsService: DownloadsService;
  let analyticsService: AnalyticsService;

  const userId = '550e8400-e29b-41d4-a716-446655440001';
  const adminClerkId = 'admin_clerk_456';
  const boundAt = new Date('2026-07-01T08:00:00.000Z');

  beforeEach(() => {
    prismaService = new PrismaService();
    downloadsService = new DownloadsService();
    analyticsService = new AnalyticsService({} as never);
    adminDevicesService = new AdminDevicesService(
      prismaService,
      downloadsService,
      analyticsService,
    );
    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
      id: userId,
      fullName: 'Student One',
      email: 'student@example.com',
      phoneNumber: '0599000000',
      telegramUsername: 'student',
      region: 'gaza',
      role: 'student',
      clerkId: 'clerk_student',
      createdAt: boundAt,
      updatedAt: boundAt,
    });
  });

  it('lists bindings for a student', async () => {
    jest.spyOn(prismaService.deviceBinding, 'findMany').mockResolvedValue([
      {
        id: 'binding-id',
        userId,
        deviceType: 'web',
        deviceHash: 'hashed-device',
        boundAt,
        lastSeenAt: boundAt,
        createdAt: boundAt,
        updatedAt: boundAt,
      },
    ]);

    await expect(adminDevicesService.listBindings(userId)).resolves.toEqual({
      userId,
      bindings: [
        {
          deviceType: 'web',
          boundAt: boundAt.toISOString(),
          lastSeenAt: boundAt.toISOString(),
        },
      ],
    });
  });

  it('throws NotFoundException when the user does not exist', async () => {
    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

    await expect(adminDevicesService.listBindings(userId)).rejects.toThrow(
      new NotFoundException('User not found'),
    );
  });

  it('resets one binding slot and revokes mobile downloads', async () => {
    jest.spyOn(prismaService.deviceBinding, 'findUnique').mockResolvedValue({
      id: 'binding-id',
      userId,
      deviceType: 'mobile',
      deviceHash: 'hashed-mobile-device',
      boundAt,
      lastSeenAt: boundAt,
      createdAt: boundAt,
      updatedAt: boundAt,
    });
    jest
      .spyOn(prismaService.deviceBinding, 'deleteMany')
      .mockResolvedValue({ count: 1 });
    jest.spyOn(prismaService.deviceBinding, 'findMany').mockResolvedValue([]);

    await expect(
      adminDevicesService.resetBinding(userId, 'mobile', adminClerkId),
    ).resolves.toEqual({
      userId,
      bindings: [],
    });

    expect(downloadsService.revokeDownloads).toHaveBeenCalledWith(userId, {
      deviceHash: 'hashed-mobile-device',
    });
    expect(prismaService.deviceBinding.deleteMany).toHaveBeenCalledWith({
      where: {
        userId,
        deviceType: 'mobile',
      },
    });
    expect(analyticsService.captureDeviceReset).toHaveBeenCalledWith(userId, {
      deviceType: 'mobile',
      adminClerkId,
    });
  });

  it('resets all bindings and revokes all downloads', async () => {
    jest
      .spyOn(prismaService.deviceBinding, 'deleteMany')
      .mockResolvedValue({ count: 2 });
    jest.spyOn(prismaService.deviceBinding, 'findMany').mockResolvedValue([]);

    await expect(
      adminDevicesService.resetAllBindings(userId, adminClerkId),
    ).resolves.toEqual({
      userId,
      bindings: [],
    });

    expect(downloadsService.revokeDownloads).toHaveBeenCalledWith(userId);
    expect(analyticsService.captureDeviceReset).toHaveBeenCalledWith(userId, {
      deviceType: 'all',
      adminClerkId,
    });
  });

  it('rejects invalid device types', async () => {
    await expect(
      adminDevicesService.resetBinding(userId, 'tablet'),
    ).rejects.toThrow(
      new BadRequestException('deviceType must be web or mobile'),
    );
  });
});
