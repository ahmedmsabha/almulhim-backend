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

  const studentUser = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clerkId: 'user_123',
    email: 'student@example.com',
    fullName: 'Student Name',
    phoneNumber: '0599000000',
    telegramUsername: 'student_tg',
    region: 'gaza' as const,
    role: 'student' as const,
    deactivatedAt: null as Date | null,
    createdAt: new Date('2026-06-30T10:00:00.000Z'),
    updatedAt: new Date('2026-06-30T10:00:00.000Z'),
  };

  const unitId = '550e8400-e29b-41d4-a716-446655440010';
  const accessEndsAt = '2027-06-30T21:00:00.000Z';

  const adminPlan = {
    id: 'plan-uuid-1',
    name: 'الفصل الأول',
    description: 'Units 1 and 2',
    priceGaza: 12000,
    priceWestBank: 25000,
    currency: 'ILS',
    accessEndsAt,
    startsAt: null as string | null,
    sortOrder: 0,
    isActive: true,
    unitIds: [unitId],
    units: [{ id: unitId, title: 'الوحدة الأولى' }],
    createdAt: '2026-06-30T10:00:00.000Z',
    updatedAt: '2026-06-30T10:00:00.000Z',
  };

  const publicPlan = {
    id: adminPlan.id,
    name: adminPlan.name,
    description: adminPlan.description,
    priceGaza: 12000,
    priceWestBank: 25000,
    currency: 'ILS',
    accessEndsAt,
    startsAt: null,
    sortOrder: 0,
    units: adminPlan.units,
  };

  const studentPlan = {
    id: adminPlan.id,
    name: adminPlan.name,
    description: adminPlan.description,
    priceAmount: 12000,
    currency: 'ILS',
    accessEndsAt,
    startsAt: null,
    sortOrder: 0,
    units: adminPlan.units,
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
      plans: [publicPlan],
    });

    await expect(plansController.listPublicPlans()).resolves.toEqual({
      plans: [publicPlan],
    });
  });

  it('delegates listActivePlans with the current user', async () => {
    plansService.listActivePlans.mockResolvedValue({
      plans: [studentPlan],
    });

    await expect(
      plansController.listActivePlans(studentUser),
    ).resolves.toEqual({
      plans: [studentPlan],
    });

    expect(plansService.listActivePlans).toHaveBeenCalledWith(studentUser);
  });

  it('delegates listAllPlans to the service', async () => {
    plansService.listAllPlans.mockResolvedValue({ plans: [adminPlan] });

    await expect(plansController.listAllPlans()).resolves.toEqual({
      plans: [adminPlan],
    });
  });

  it('delegates createPlan to the service', async () => {
    plansService.createPlan.mockResolvedValue(adminPlan);

    const body = {
      name: 'الفصل الأول',
      priceGaza: 12000,
      priceWestBank: 25000,
      accessEndsAt,
      unitIds: [unitId],
    };

    await expect(plansController.createPlan(body)).resolves.toEqual(adminPlan);

    expect(plansService.createPlan).toHaveBeenCalledWith(body);
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
