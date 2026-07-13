import { DeviceHashService } from './device-hash.service';

describe('DeviceHashService', () => {
  it('hashes device identifiers with the configured pepper', () => {
    const configService = {
      get: jest.fn().mockReturnValue('test-pepper'),
    };
    const deviceHashService = new DeviceHashService(configService as never);

    const firstHash = deviceHashService.hash(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    const secondHash = deviceHashService.hash(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    const differentHash = deviceHashService.hash(
      '660e8400-e29b-41d4-a716-446655440000',
    );

    expect(firstHash).toBe(secondHash);
    expect(firstHash).not.toBe(differentHash);
    expect(firstHash).toHaveLength(64);
  });
});
