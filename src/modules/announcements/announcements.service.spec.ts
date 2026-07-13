jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    announcement = {
      findMany: jest.fn(),
    };
  },
}));

jest.mock('../../lib/storage/r2-storage.service', () => ({
  R2StorageService: class MockR2StorageService {
    createSignedGetUrl = jest.fn();
  },
}));

import { PrismaService } from '../../lib/database/prisma.service';
import { R2StorageService } from '../../lib/storage/r2-storage.service';
import { AnnouncementsService } from './announcements.service';

describe('AnnouncementsService', () => {
  let announcementsService: AnnouncementsService;
  let prismaService: PrismaService;
  let r2StorageService: R2StorageService;

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

  const publishedAt = new Date('2026-07-01T09:00:00.000Z');

  beforeEach(() => {
    prismaService = new PrismaService();
    r2StorageService = new R2StorageService({} as never);
    announcementsService = new AnnouncementsService(
      prismaService,
      r2StorageService,
    );
  });

  it('returns published announcements for the student region with signed image URLs', async () => {
    jest.spyOn(prismaService.announcement, 'findMany').mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        title: 'Update',
        body: 'Body text',
        region: 'gaza',
        imageStorageKey: 'announcements/id/image.jpg',
        isPublished: true,
        publishedAt,
        createdAt: publishedAt,
        updatedAt: publishedAt,
      },
    ]);
    jest
      .spyOn(r2StorageService, 'createSignedGetUrl')
      .mockResolvedValue('https://signed.example/image.jpg');

    const result = await announcementsService.listForUser(user);

    expect(prismaService.announcement.findMany).toHaveBeenCalledWith({
      where: {
        isPublished: true,
        OR: [{ region: 'gaza' }, { region: 'both' }],
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
    expect(result.announcements).toEqual([
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        title: 'Update',
        body: 'Body text',
        region: 'gaza',
        publishedAt: publishedAt.toISOString(),
        imageUrl: 'https://signed.example/image.jpg',
      },
    ]);
  });

  it('returns the feed when one announcement image URL fails to sign', async () => {
    jest.spyOn(prismaService.announcement, 'findMany').mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        title: 'Broken Image',
        body: 'Body text',
        region: 'gaza',
        imageStorageKey: 'announcements/id/missing.jpg',
        isPublished: true,
        publishedAt,
        createdAt: publishedAt,
        updatedAt: publishedAt,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440011',
        title: 'Healthy Image',
        body: 'More text',
        region: 'gaza',
        imageStorageKey: 'announcements/id/healthy.jpg',
        isPublished: true,
        publishedAt,
        createdAt: publishedAt,
        updatedAt: publishedAt,
      },
    ]);
    jest
      .spyOn(r2StorageService, 'createSignedGetUrl')
      .mockRejectedValueOnce(new Error('Object not found'))
      .mockResolvedValueOnce('https://signed.example/healthy.jpg');

    const result = await announcementsService.listForUser(user);

    expect(result.announcements).toEqual([
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        title: 'Broken Image',
        body: 'Body text',
        region: 'gaza',
        publishedAt: publishedAt.toISOString(),
        imageUrl: null,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440011',
        title: 'Healthy Image',
        body: 'More text',
        region: 'gaza',
        publishedAt: publishedAt.toISOString(),
        imageUrl: 'https://signed.example/healthy.jpg',
      },
    ]);
  });
});
