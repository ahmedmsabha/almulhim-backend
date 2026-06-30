jest.mock('./plans.service', () => ({
  PlansService: class MockPlansService {},
}));

import { BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

describe('PlansController', () => {
  let plansController: PlansController;
  let plansService: jest.Mocked<
    Pick<
      PlansService,
      | 'listPublicPlans'
      | 'listActivePlans'
      | 'listAllPlans'
      | 'createPlan'
      | 'updatePlan'
    >
  >;

  const adminPlan = {
    id: 'plan-uuid-1',
    name: 'Monthly',
    description: 'One month access',
    priceAmount: 9900,
    currency: 'ILS',
    durationDays: 30,
    sortOrder: 0,
    isActive: true,
    createdAt: '2026-06-30T10:00:00.000Z',
    updatedAt: '2026-06-30T10:00:00.000Z',
  };

  beforeEach(() => {
    plansService = {
      listPublicPlans: jest.fn(),
      listActivePlans: jest.fn(),
      listAllPlans: jest.fn(),
      createPlan: jest.fn(),
      updatePlan: jest.fn(),
    };
    plansController = new PlansController(
      plansService as unknown as PlansService,
    );
  });

  it('delegates listPublicPlans to the service', async () => {
    plansService.listPublicPlans.mockResolvedValue({
      plans: [{ name: 'Monthly', priceAmount: 9900, currency: 'ILS' }],
    });

    await expect(plansController.listPublicPlans()).resolves.toEqual({
      plans: [{ name: 'Monthly', priceAmount: 9900, currency: 'ILS' }],
    });
  });

  it('delegates listActivePlans to the service', async () => {
    plansService.listActivePlans.mockResolvedValue({
      plans: [
        {
          id: adminPlan.id,
          name: adminPlan.name,
          description: adminPlan.description,
          priceAmount: adminPlan.priceAmount,
          currency: adminPlan.currency,
          durationDays: adminPlan.durationDays,
          sortOrder: adminPlan.sortOrder,
        },
      ],
    });

    await expect(plansController.listActivePlans()).resolves.toEqual({
      plans: [
        {
          id: adminPlan.id,
          name: adminPlan.name,
          description: adminPlan.description,
          priceAmount: adminPlan.priceAmount,
          currency: adminPlan.currency,
          durationDays: adminPlan.durationDays,
          sortOrder: adminPlan.sortOrder,
        },
      ],
    });
  });

  it('delegates listAllPlans to the service', async () => {
    plansService.listAllPlans.mockResolvedValue({ plans: [adminPlan] });

    await expect(plansController.listAllPlans()).resolves.toEqual({
      plans: [adminPlan],
    });
  });

  it('delegates createPlan to the service', async () => {
    plansService.createPlan.mockResolvedValue(adminPlan);

    await expect(
      plansController.createPlan({
        name: 'Monthly',
        priceAmount: 9900,
        durationDays: 30,
      }),
    ).resolves.toEqual(adminPlan);

    expect(plansService.createPlan).toHaveBeenCalledWith({
      name: 'Monthly',
      priceAmount: 9900,
      durationDays: 30,
    });
  });

  it('maps Zod validation errors to BadRequestException on create', async () => {
    plansService.createPlan.mockRejectedValue(
      new ZodError([
        {
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Required',
          path: ['name'],
        },
      ]),
    );

    await expect(plansController.createPlan({})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('delegates updatePlan to the service', async () => {
    plansService.updatePlan.mockResolvedValue({
      ...adminPlan,
      isActive: false,
    });

    await expect(
      plansController.updatePlan('plan-uuid-1', { isActive: false }),
    ).resolves.toEqual({
      ...adminPlan,
      isActive: false,
    });

    expect(plansService.updatePlan).toHaveBeenCalledWith('plan-uuid-1', {
      isActive: false,
    });
  });

  it('maps Zod validation errors to BadRequestException on update', async () => {
    plansService.updatePlan.mockRejectedValue(
      new ZodError([
        {
          code: 'custom',
          message: 'At least one field is required',
          path: [],
        },
      ]),
    );

    await expect(
      plansController.updatePlan('plan-uuid-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
