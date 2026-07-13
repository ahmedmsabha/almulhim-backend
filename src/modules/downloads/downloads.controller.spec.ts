jest.mock('./downloads.service', () => ({
  DownloadsService: class MockDownloadsService {},
}));

jest.mock('../../common/decorators/requires-device-binding.decorator', () => ({
  RequiresDeviceBinding: () => () => undefined,
}));

import { DownloadsController } from './downloads.controller';
import { DownloadsService } from './downloads.service';

describe('DownloadsController', () => {
  let downloadsController: DownloadsController;
  let downloadsService: jest.Mocked<
    Pick<
      DownloadsService,
      'authorizeVideoDownloadFromRequest' | 'listMyDownloadsFromRequest'
    >
  >;

  const request = {
    user: {
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
    },
    device: {
      deviceType: 'mobile' as const,
      deviceIdentifier: '550e8400-e29b-41d4-a716-446655440099',
      deviceHash: 'hashed-mobile-device',
    },
  };

  beforeEach(() => {
    downloadsService = {
      authorizeVideoDownloadFromRequest: jest.fn(),
      listMyDownloadsFromRequest: jest.fn(),
    };
    downloadsController = new DownloadsController(
      downloadsService as unknown as DownloadsService,
    );
  });

  it('delegates authorize requests to the service', async () => {
    downloadsService.authorizeVideoDownloadFromRequest.mockResolvedValue({
      downloadId: '550e8400-e29b-41d4-a716-446655440060',
      url: 'https://r2.example.com/signed-video',
      expiresAt: '2026-07-01T10:15:00.000Z',
    });

    await expect(
      downloadsController.authorizeVideoDownload(
        request,
        '550e8400-e29b-41d4-a716-446655440050',
      ),
    ).resolves.toMatchObject({
      downloadId: '550e8400-e29b-41d4-a716-446655440060',
    });

    expect(
      downloadsService.authorizeVideoDownloadFromRequest,
    ).toHaveBeenCalledWith(request, '550e8400-e29b-41d4-a716-446655440050');
  });

  it('delegates sync reads to the service', async () => {
    downloadsService.listMyDownloadsFromRequest.mockResolvedValue({
      downloads: [],
    });

    await expect(downloadsController.listMyDownloads(request)).resolves.toEqual(
      {
        downloads: [],
      },
    );

    expect(downloadsService.listMyDownloadsFromRequest).toHaveBeenCalledWith(
      request,
    );
  });
});
