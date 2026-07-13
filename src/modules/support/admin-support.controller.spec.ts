jest.mock('./admin-support.service', () => ({
  AdminSupportService: class MockAdminSupportService {},
}));

import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';

describe('AdminSupportController', () => {
  let adminSupportController: AdminSupportController;
  let adminSupportService: jest.Mocked<
    Pick<AdminSupportService, 'listRequests' | 'reply' | 'close'>
  >;

  beforeEach(() => {
    adminSupportService = {
      listRequests: jest.fn(),
      reply: jest.fn(),
      close: jest.fn(),
    };
    adminSupportController = new AdminSupportController(
      adminSupportService as unknown as AdminSupportService,
    );
  });

  it('delegates listRequests to the service', async () => {
    adminSupportService.listRequests.mockResolvedValue({ requests: [] });

    await expect(
      adminSupportController.listRequests({ status: 'open' }),
    ).resolves.toEqual({ requests: [] });
  });

  it('delegates close to the service', async () => {
    adminSupportService.close.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440020',
      subject: 'Help',
      message: 'Need help',
      status: 'closed',
      adminReply: 'Done',
      reviewedAt: '2026-07-01T09:00:00.000Z',
      closedAt: '2026-07-01T10:00:00.000Z',
      createdAt: '2026-07-01T08:00:00.000Z',
      student: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        fullName: 'Student One',
        email: 'student@example.com',
        phoneNumber: '0599000000',
        region: 'gaza',
      },
    });

    await expect(
      adminSupportController.close('550e8400-e29b-41d4-a716-446655440020'),
    ).resolves.toMatchObject({ status: 'closed' });
  });
});
