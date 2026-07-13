jest.mock('./announcements.service', () => ({
  AnnouncementsService: class MockAnnouncementsService {},
}));

import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

describe('AnnouncementsController', () => {
  let announcementsController: AnnouncementsController;
  let announcementsService: jest.Mocked<
    Pick<AnnouncementsService, 'listForUser'>
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
    announcementsService = {
      listForUser: jest.fn(),
    };
    announcementsController = new AnnouncementsController(
      announcementsService as unknown as AnnouncementsService,
    );
  });

  it('delegates list to the service', async () => {
    announcementsService.listForUser.mockResolvedValue({ announcements: [] });

    await expect(announcementsController.list(user)).resolves.toEqual({
      announcements: [],
    });

    expect(announcementsService.listForUser).toHaveBeenCalledWith(user);
  });
});
