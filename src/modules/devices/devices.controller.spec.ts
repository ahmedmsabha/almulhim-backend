jest.mock('./devices.service', () => ({
  DevicesService: class MockDevicesService {},
}));

jest.mock('../../common/decorators/requires-device-binding.decorator', () => ({
  RequiresDeviceBinding: () => () => undefined,
}));

import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

describe('DevicesController', () => {
  let devicesController: DevicesController;
  let devicesService: jest.Mocked<
    Pick<DevicesService, 'bind' | 'getStatus' | 'heartbeat'>
  >;

  const user = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    fullName: 'Student One',
    email: 'student@example.com',
    phoneNumber: '0599000000',
    telegramUsername: 'student',
    region: 'gaza' as const,
    role: 'student' as const,
    clerkId: 'clerk_student',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    devicesService = {
      bind: jest.fn(),
      getStatus: jest.fn(),
      heartbeat: jest.fn(),
    };
    devicesController = new DevicesController(
      devicesService as unknown as DevicesService,
    );
  });

  it('delegates bind to the service', async () => {
    devicesService.bind.mockResolvedValue({
      deviceType: 'web',
      boundAt: '2026-07-01T08:00:00.000Z',
      lastSeenAt: '2026-07-01T08:00:00.000Z',
    });

    await expect(
      devicesController.bind(user, {
        deviceType: 'web',
        deviceIdentifier: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).resolves.toMatchObject({ deviceType: 'web' });

    expect(devicesService.bind).toHaveBeenCalledWith(user, {
      deviceType: 'web',
      deviceIdentifier: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('delegates status reads to the service', async () => {
    devicesService.getStatus.mockResolvedValue({
      web: { bound: false, boundAt: null, lastSeenAt: null },
      mobile: { bound: false, boundAt: null, lastSeenAt: null },
    });

    await expect(devicesController.getStatus(user)).resolves.toEqual({
      web: { bound: false, boundAt: null, lastSeenAt: null },
      mobile: { bound: false, boundAt: null, lastSeenAt: null },
    });
  });
});
