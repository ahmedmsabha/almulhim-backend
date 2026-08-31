jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    subscription = {
      findMany: jest.fn(),
    };
  },
}));

import { PrismaService } from '../../lib/database/prisma.service';
import { SubscriptionAccessService } from './subscription-access.service';

describe('SubscriptionAccessService', () => {
  let service: SubscriptionAccessService;
  let prismaService: PrismaService;

  beforeEach(() => {
    prismaService = new PrismaService({} as never);
    service = new SubscriptionAccessService(prismaService);
  });

  it('returns the union of unit ids from stacked active subscriptions', async () => {
    jest.spyOn(prismaService.subscription, 'findMany').mockResolvedValue([
      {
        plan: {
          units: [{ unitId: 'unit-1' }, { unitId: 'unit-2' }],
        },
      },
      {
        plan: {
          units: [{ unitId: 'unit-2' }, { unitId: 'unit-3' }],
        },
      },
    ] as never);

    await expect(service.getEntitledUnitIds('user-1')).resolves.toEqual(
      new Set(['unit-1', 'unit-2', 'unit-3']),
    );

    expect(prismaService.subscription.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: 'active',
        expiresAt: { gt: expect.any(Date) },
      },
      select: { plan: { select: { units: { select: { unitId: true } } } } },
    });
  });

  it('returns an empty set when the student has no active subscriptions', async () => {
    jest.spyOn(prismaService.subscription, 'findMany').mockResolvedValue([]);

    await expect(service.getEntitledUnitIds('user-1')).resolves.toEqual(
      new Set(),
    );
  });
});
