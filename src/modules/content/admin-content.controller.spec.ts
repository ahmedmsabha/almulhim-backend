jest.mock('./admin-content.service', () => ({
  AdminContentService: class MockAdminContentService {},
}));

import { BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';
import { AdminContentController } from './admin-content.controller';
import { AdminContentService } from './admin-content.service';

describe('AdminContentController', () => {
  let adminContentController: AdminContentController;
  let adminContentService: jest.Mocked<
    Pick<
      AdminContentService,
      | 'createUnit'
      | 'publishUnit'
      | 'createVideoUploadUrl'
      | 'attachVideo'
      | 'deleteVideo'
      | 'deletePdf'
    >
  >;

  const unit = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    title: 'Unit One',
    description: null,
    region: 'gaza' as const,
    sortOrder: 0,
    isPublished: false,
    publishedAt: null,
  };

  beforeEach(() => {
    adminContentService = {
      createUnit: jest.fn(),
      publishUnit: jest.fn(),
      createVideoUploadUrl: jest.fn(),
      attachVideo: jest.fn(),
      deleteVideo: jest.fn(),
      deletePdf: jest.fn(),
    };
    adminContentController = new AdminContentController(
      adminContentService as unknown as AdminContentService,
    );
  });

  it('delegates createUnit to the service', async () => {
    adminContentService.createUnit.mockResolvedValue(unit);

    await expect(
      adminContentController.createUnit({
        title: 'Unit One',
        region: 'gaza',
      }),
    ).resolves.toEqual(unit);

    expect(adminContentService.createUnit).toHaveBeenCalledWith({
      title: 'Unit One',
      region: 'gaza',
    });
  });

  it('delegates publishUnit to the service', async () => {
    adminContentService.publishUnit.mockResolvedValue({
      ...unit,
      isPublished: true,
      publishedAt: '2026-07-01T08:00:00.000Z',
    });

    await expect(
      adminContentController.publishUnit(unit.id),
    ).resolves.toMatchObject({
      isPublished: true,
    });
  });

  it('maps Zod validation errors to BadRequestException on createUnit', async () => {
    adminContentService.createUnit.mockRejectedValue(
      new ZodError([
        {
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Required',
          path: ['title'],
        },
      ]),
    );

    await expect(adminContentController.createUnit({})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('delegates createVideoUploadUrl to the service', async () => {
    adminContentService.createVideoUploadUrl.mockResolvedValue({
      uploadUrl: 'https://upload.example/video',
      storageKey: 'videos/lesson/file.mp4',
      expiresInSeconds: 900,
    });

    await expect(
      adminContentController.createVideoUploadUrl(
        '550e8400-e29b-41d4-a716-446655440030',
        { contentType: 'video/mp4' },
      ),
    ).resolves.toEqual({
      uploadUrl: 'https://upload.example/video',
      storageKey: 'videos/lesson/file.mp4',
      expiresInSeconds: 900,
    });
  });

  it('delegates deleteVideo to the service', async () => {
    const videoId = '550e8400-e29b-41d4-a716-446655440040';
    adminContentService.deleteVideo.mockResolvedValue({
      deleted: true,
      id: videoId,
    });

    await expect(adminContentController.deleteVideo(videoId)).resolves.toEqual({
      deleted: true,
      id: videoId,
    });
  });

  it('delegates deletePdf to the service', async () => {
    const pdfId = '550e8400-e29b-41d4-a716-446655440050';
    adminContentService.deletePdf.mockResolvedValue({
      deleted: true,
      id: pdfId,
    });

    await expect(adminContentController.deletePdf(pdfId)).resolves.toEqual({
      deleted: true,
      id: pdfId,
    });
  });
});
