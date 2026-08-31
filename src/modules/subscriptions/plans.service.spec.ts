jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    subscriptionPlan = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    unit = {
      findMany: jest.fn(),
    };
    planUnit = {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    };
    $transaction = jest.fn();
  },
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/database/prisma.service';
import { PlansService } from './plans.service';
import { PLAN_WITH_UNITS_INCLUDE } from './types/plan.response';

describe('PlansService', () => {
  let plansService: PlansService;
  let prismaService: PrismaService;

  const unitId = '550e8400-e29b-41d4-a716-446655440010';
  const accessEndsAt = new Date('2027-06-30T21:00:00.000Z');
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

  const plan = {
    id: 'plan-uuid-1',
    name: 'الفصل الأول',
    description: 'Units 1 and 2',
    priceGaza: 12000,
    priceWestBank: 25000,
    currency: 'ILS',
    accessEndsAt,
    startsAt: null as Date | null,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date('2026-06-30T10:00:00.000Z'),
    updatedAt: new Date('2026-06-30T10:00:00.000Z'),
    units: [
      {
        unitId,
        unit: { id: unitId, title: 'الوحدة الأولى', sortOrder: 0 },
      },
    ],
  };

  const unitSummary = { id: unitId, title: 'الوحدة الأولى' };

  beforeEach(() => {
    prismaService = new PrismaService({} as never);
    plansService = new PlansService(prismaService);
  });

  describe('listPublicPlans', () => {
    it('returns active plans with both regional prices and units', async () => {
      jest
        .spyOn(prismaService.subscriptionPlan, 'findMany')
        .mockResolvedValue([plan] as never);

      await expect(plansService.listPublicPlans()).resolves.toEqual({
        plans: [
          {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            priceGaza: 12000,
            priceWestBank: 25000,
            currency: 'ILS',
            accessEndsAt: accessEndsAt.toISOString(),
            startsAt: null,
            sortOrder: 0,
            units: [unitSummary],
          },
        ],
      });

      expect(prismaService.subscriptionPlan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: PLAN_WITH_UNITS_INCLUDE,
      });
    });
  });

  describe('listActivePlans', () => {
    it('resolves priceAmount for the caller region', async () => {
      jest
        .spyOn(prismaService.subscriptionPlan, 'findMany')
        .mockResolvedValue([plan] as never);

      await expect(
        plansService.listActivePlans(studentUser),
      ).resolves.toEqual({
        plans: [
          {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            priceAmount: 12000,
            currency: 'ILS',
            accessEndsAt: accessEndsAt.toISOString(),
            startsAt: null,
            sortOrder: 0,
            units: [unitSummary],
          },
        ],
      });
    });

    it('uses West Bank price for west_bank students', async () => {
      jest
        .spyOn(prismaService.subscriptionPlan, 'findMany')
        .mockResolvedValue([plan] as never);

      const result = await plansService.listActivePlans({
        ...studentUser,
        region: 'west_bank',
      });

      expect(result.plans[0].priceAmount).toBe(25000);
    });
  });

  describe('listAllPlans', () => {
    it('returns all plans including inactive ones', async () => {
      const inactivePlan = { ...plan, id: 'plan-uuid-2', isActive: false };
      jest
        .spyOn(prismaService.subscriptionPlan, 'findMany')
        .mockResolvedValue([plan, inactivePlan] as never);

      await expect(plansService.listAllPlans()).resolves.toEqual({
        plans: [
          {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            priceGaza: 12000,
            priceWestBank: 25000,
            currency: 'ILS',
            accessEndsAt: accessEndsAt.toISOString(),
            startsAt: null,
            sortOrder: 0,
            isActive: true,
            unitIds: [unitId],
            units: [unitSummary],
            createdAt: plan.createdAt.toISOString(),
            updatedAt: plan.updatedAt.toISOString(),
          },
          {
            id: inactivePlan.id,
            name: inactivePlan.name,
            description: inactivePlan.description,
            priceGaza: 12000,
            priceWestBank: 25000,
            currency: 'ILS',
            accessEndsAt: accessEndsAt.toISOString(),
            startsAt: null,
            sortOrder: 0,
            isActive: false,
            unitIds: [unitId],
            units: [unitSummary],
            createdAt: inactivePlan.createdAt.toISOString(),
            updatedAt: inactivePlan.updatedAt.toISOString(),
          },
        ],
      });
    });
  });

  describe('createPlan', () => {
    it('creates a plan with unit links in a transaction', async () => {
      const tx = {
        unit: {
          findMany: jest.fn().mockResolvedValue([{ id: unitId }]),
        },
        subscriptionPlan: {
          create: jest.fn().mockResolvedValue(plan),
        },
      };
      jest
        .spyOn(prismaService, '$transaction')
        .mockImplementation(async (callback) =>
          (callback as (client: typeof tx) => Promise<unknown>)(tx),
        );

      await expect(
        plansService.createPlan({
          name: 'الفصل الأول',
          priceGaza: 12000,
          priceWestBank: 25000,
          accessEndsAt: accessEndsAt.toISOString(),
          unitIds: [unitId],
        }),
      ).resolves.toEqual({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        priceGaza: 12000,
        priceWestBank: 25000,
        currency: 'ILS',
        accessEndsAt: accessEndsAt.toISOString(),
        startsAt: null,
        sortOrder: 0,
        isActive: true,
        unitIds: [unitId],
        units: [unitSummary],
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      });

      expect(tx.subscriptionPlan.create).toHaveBeenCalledWith({
        data: {
          name: 'الفصل الأول',
          description: undefined,
          priceGaza: 12000,
          priceWestBank: 25000,
          currency: 'ILS',
          accessEndsAt,
          startsAt: null,
          sortOrder: 0,
          units: {
            create: [{ unitId }],
          },
        },
        include: PLAN_WITH_UNITS_INCLUDE,
      });
    });

    it('throws when a unit id does not exist', async () => {
      const tx = {
        unit: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        subscriptionPlan: {
          create: jest.fn(),
        },
      };
      jest
        .spyOn(prismaService, '$transaction')
        .mockImplementation(async (callback) =>
          (callback as (client: typeof tx) => Promise<unknown>)(tx),
        );

      await expect(
        plansService.createPlan({
          name: 'الفصل الأول',
          priceGaza: 12000,
          priceWestBank: 25000,
          accessEndsAt: accessEndsAt.toISOString(),
          unitIds: [unitId],
        }),
      ).rejects.toThrow(
        new BadRequestException('One or more units were not found'),
      );
    });
  });

  describe('updatePlan', () => {
    it('updates an existing plan', async () => {
      const updated = { ...plan, isActive: false };
      const tx = {
        unit: { findMany: jest.fn() },
        subscriptionPlan: {
          update: jest.fn().mockResolvedValue(updated),
          findUniqueOrThrow: jest.fn().mockResolvedValue(updated),
        },
        planUnit: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
      };
      jest
        .spyOn(prismaService.subscriptionPlan, 'findUnique')
        .mockResolvedValue(plan as never);
      jest
        .spyOn(prismaService, '$transaction')
        .mockImplementation(async (callback) =>
          (callback as (client: typeof tx) => Promise<unknown>)(tx),
        );

      await expect(
        plansService.updatePlan('plan-uuid-1', { isActive: false }),
      ).resolves.toEqual({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        priceGaza: 12000,
        priceWestBank: 25000,
        currency: 'ILS',
        accessEndsAt: accessEndsAt.toISOString(),
        startsAt: null,
        sortOrder: 0,
        isActive: false,
        unitIds: [unitId],
        units: [unitSummary],
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      });

      expect(tx.planUnit.deleteMany).not.toHaveBeenCalled();
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
