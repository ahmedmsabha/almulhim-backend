jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    subscriptionPlan = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
  },
}));

import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/database/prisma.service';
import { PlansService } from './plans.service';

describe('PlansService', () => {
  let plansService: PlansService;
  let prismaService: PrismaService;

  const plan = {
    id: 'plan-uuid-1',
    name: 'Monthly',
    description: 'One month access',
    priceAmount: 9900,
    currency: 'ILS',
    durationDays: 30,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date('2026-06-30T10:00:00.000Z'),
    updatedAt: new Date('2026-06-30T10:00:00.000Z'),
  };

  beforeEach(() => {
    prismaService = new PrismaService({} as never);
    plansService = new PlansService(prismaService);
  });

  describe('listPublicPlans', () => {
    it('returns active plans with name and price only', async () => {
      jest
        .spyOn(prismaService.subscriptionPlan, 'findMany')
        .mockResolvedValue([plan]);

      await expect(plansService.listPublicPlans()).resolves.toEqual({
        plans: [{ name: 'Monthly', priceAmount: 9900, currency: 'ILS' }],
      });

      expect(prismaService.subscriptionPlan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('listActivePlans', () => {
    it('returns active plans with full subscribe-flow fields', async () => {
      jest
        .spyOn(prismaService.subscriptionPlan, 'findMany')
        .mockResolvedValue([plan]);

      await expect(plansService.listActivePlans()).resolves.toEqual({
        plans: [
          {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            priceAmount: plan.priceAmount,
            currency: plan.currency,
            durationDays: plan.durationDays,
            sortOrder: plan.sortOrder,
          },
        ],
      });
    });
  });

  describe('listAllPlans', () => {
    it('returns all plans including inactive ones', async () => {
      const inactivePlan = { ...plan, id: 'plan-uuid-2', isActive: false };
      jest
        .spyOn(prismaService.subscriptionPlan, 'findMany')
        .mockResolvedValue([plan, inactivePlan]);

      await expect(plansService.listAllPlans()).resolves.toEqual({
        plans: [
          {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            priceAmount: plan.priceAmount,
            currency: plan.currency,
            durationDays: plan.durationDays,
            sortOrder: plan.sortOrder,
            isActive: true,
            createdAt: plan.createdAt.toISOString(),
            updatedAt: plan.updatedAt.toISOString(),
          },
          {
            id: inactivePlan.id,
            name: inactivePlan.name,
            description: inactivePlan.description,
            priceAmount: inactivePlan.priceAmount,
            currency: inactivePlan.currency,
            durationDays: inactivePlan.durationDays,
            sortOrder: inactivePlan.sortOrder,
            isActive: false,
            createdAt: inactivePlan.createdAt.toISOString(),
            updatedAt: inactivePlan.updatedAt.toISOString(),
          },
        ],
      });
    });
  });

  describe('createPlan', () => {
    it('creates a plan from validated input', async () => {
      jest
        .spyOn(prismaService.subscriptionPlan, 'create')
        .mockResolvedValue(plan);

      await expect(
        plansService.createPlan({
          name: 'Monthly',
          priceAmount: 9900,
          durationDays: 30,
        }),
      ).resolves.toEqual({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        priceAmount: plan.priceAmount,
        currency: plan.currency,
        durationDays: plan.durationDays,
        sortOrder: plan.sortOrder,
        isActive: true,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      });

      expect(prismaService.subscriptionPlan.create).toHaveBeenCalledWith({
        data: {
          name: 'Monthly',
          description: undefined,
          priceAmount: 9900,
          currency: 'ILS',
          durationDays: 30,
          sortOrder: 0,
        },
      });
    });
  });

  describe('updatePlan', () => {
    it('updates an existing plan', async () => {
      jest
        .spyOn(prismaService.subscriptionPlan, 'findUnique')
        .mockResolvedValue(plan);
      jest.spyOn(prismaService.subscriptionPlan, 'update').mockResolvedValue({
        ...plan,
        isActive: false,
      });

      await expect(
        plansService.updatePlan('plan-uuid-1', { isActive: false }),
      ).resolves.toEqual({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        priceAmount: plan.priceAmount,
        currency: plan.currency,
        durationDays: plan.durationDays,
        sortOrder: plan.sortOrder,
        isActive: false,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      });
    });

    it('throws NotFoundException when plan does not exist', async () => {
      jest
        .spyOn(prismaService.subscriptionPlan, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        plansService.updatePlan('missing-id', { isActive: false }),
      ).rejects.toThrow(new NotFoundException('Plan not found'));
    });
  });
});
