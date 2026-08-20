jest.mock('./downloads.service', () => ({
  DownloadsService: class MockDownloadsService {},
}));

jest.mock('../../common/decorators/requires-device-binding.decorator', () => ({
  RequiresDeviceBinding: () => () => undefined,
}));

import { PassThrough } from 'node:stream';

import { IS_PUBLIC_KEY } from '../../common/constants/auth-metadata';
import { DownloadsController } from './downloads.controller';
import { DownloadsService } from './downloads.service';

describe('DownloadsController', () => {
  let downloadsController: DownloadsController;
  let downloadsService: jest.Mocked<
    Pick<
      DownloadsService,
      'authorizeVideoDownloadFromRequest'
      | 'listMyDownloadsFromRequest'
      | 'resolveVideoStreamAccessFromRequest'
      | 'openVideoStream'
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
      resolveVideoStreamAccessFromRequest: jest.fn(),
      openVideoStream: jest.fn(),
    };
    downloadsController = new DownloadsController(
      downloadsService as unknown as DownloadsService,
    );
  });

  it('delegates authorize requests to the service', async () => {
    downloadsService.authorizeVideoDownloadFromRequest.mockResolvedValue({
      downloadId: '550e8400-e29b-41d4-a716-446655440060',
      url: '',
      streamTicket: '',
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

  it('resolves web stream access from the authenticated request, not a ticket', async () => {
    const body = new PassThrough();
    body.end(Buffer.from([0]));
    downloadsService.resolveVideoStreamAccessFromRequest.mockResolvedValue({
      storageKey: 'videos/preview/video.mp4',
      contentType: 'video/mp4',
      contentLength: 1,
    });
    downloadsService.openVideoStream.mockResolvedValue({
      statusCode: 200,
      contentType: 'video/mp4',
      contentLength: 1,
      contentRange: undefined,
      body,
    });
    const response = Object.assign(new PassThrough(), {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      headersSent: false,
    });

    await downloadsController.streamVideoForWebGet(
      request as never,
      response as never,
      '550e8400-e29b-41d4-a716-446655440050',
    );

    expect(
      downloadsService.resolveVideoStreamAccessFromRequest,
    ).toHaveBeenCalledWith(request, '550e8400-e29b-41d4-a716-446655440050');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/octet-stream',
    );
  });

  it('does not expose the web stream as a public ticketed URL', () => {
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        DownloadsController.prototype.streamVideoForWebGet,
      ),
    ).not.toBe(true);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        DownloadsController.prototype.streamVideoGet,
      ),
    ).toBe(true);
  });
});
