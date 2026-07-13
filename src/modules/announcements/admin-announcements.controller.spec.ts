jest.mock('./admin-announcements.service', () => ({
  AdminAnnouncementsService: class MockAdminAnnouncementsService {},
}));

import { BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';
import { AdminAnnouncementsController } from './admin-announcements.controller';
import { AdminAnnouncementsService } from './admin-announcements.service';

describe('AdminAnnouncementsController', () => {
  let adminAnnouncementsController: AdminAnnouncementsController;
  let adminAnnouncementsService: jest.Mocked<
    Pick<
      AdminAnnouncementsService,
      'create' | 'publish' | 'createImageUploadUrl' | 'attachImage'
    >
  >;

  const announcement = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    title: 'Update',
    body: 'Body text',
    region: 'gaza' as const,
    imageStorageKey: null,
    isPublished: false,
    publishedAt: null,
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
  };

  beforeEach(() => {
    adminAnnouncementsService = {
      create: jest.fn(),
      publish: jest.fn(),
      createImageUploadUrl: jest.fn(),
      attachImage: jest.fn(),
    };
    adminAnnouncementsController = new AdminAnnouncementsController(
      adminAnnouncementsService as unknown as AdminAnnouncementsService,
    );
  });

  it('delegates create to the service', async () => {
    adminAnnouncementsService.create.mockResolvedValue(announcement);

    await expect(
      adminAnnouncementsController.create({
        title: 'Update',
        body: 'Body text',
        region: 'gaza',
      }),
    ).resolves.toEqual(announcement);
  });

  it('delegates publish to the service', async () => {
    adminAnnouncementsService.publish.mockResolvedValue({
      ...announcement,
      isPublished: true,
      publishedAt: '2026-07-01T09:00:00.000Z',
    });

    await expect(
      adminAnnouncementsController.publish(announcement.id, 'admin_clerk_456'),
    ).resolves.toMatchObject({ isPublished: true });

    expect(adminAnnouncementsService.publish).toHaveBeenCalledWith(
      announcement.id,
      'admin_clerk_456',
    );
  });

  it('maps Zod validation errors to BadRequestException on create', async () => {
    adminAnnouncementsService.create.mockRejectedValue(
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

    await expect(
      adminAnnouncementsController.create({
        body: 'Body text',
        region: 'gaza',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
