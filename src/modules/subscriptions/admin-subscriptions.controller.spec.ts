jest.mock('./admin-subscriptions.service', () => ({
  AdminSubscriptionsService: class MockAdminSubscriptionsService {},
}));

import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminSubscriptionsService } from './admin-subscriptions.service';

describe('AdminSubscriptionsController', () => {
  let controller: AdminSubscriptionsController;
  let service: jest.Mocked<
    Pick<
      AdminSubscriptionsService,
      | 'listPending'
      | 'listArchived'
      | 'listAiLogs'
      | 'getSubscriptionById'
      | 'getReceiptUrl'
      | 'approveSubscription'
      | 'rejectSubscription'
      | 'suspendSubscription'
    >
  >;

  beforeEach(() => {
    service = {
      listPending: jest.fn(),
      listArchived: jest.fn(),
      listAiLogs: jest.fn(),
      getSubscriptionById: jest.fn(),
      getReceiptUrl: jest.fn(),
      approveSubscription: jest.fn(),
      rejectSubscription: jest.fn(),
      suspendSubscription: jest.fn(),
    };
    controller = new AdminSubscriptionsController(
      service as unknown as AdminSubscriptionsService,
    );
  });

  it('delegates listArchived to the service (static path, not UUID)', async () => {
    service.listArchived.mockResolvedValue({ subscriptions: [] });

    await expect(controller.listArchived()).resolves.toEqual({
      subscriptions: [],
    });
    expect(service.listArchived).toHaveBeenCalled();
    expect(service.getSubscriptionById).not.toHaveBeenCalled();
  });

  it('delegates listAiLogs to the service (static path, not UUID)', async () => {
    service.listAiLogs.mockResolvedValue({ logs: [] });

    await expect(controller.listAiLogs()).resolves.toEqual({ logs: [] });
    expect(service.listAiLogs).toHaveBeenCalled();
    expect(service.getSubscriptionById).not.toHaveBeenCalled();
  });
});
