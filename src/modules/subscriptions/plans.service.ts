import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../../lib/database/prisma.service';
import {
  createPlanSchema,
  type CreatePlanInput,
} from './schemas/create-plan.schema';
import {
  updatePlanSchema,
  type UpdatePlanInput,
} from './schemas/update-plan.schema';
import {
  PLAN_WITH_UNITS_INCLUDE,
  toAdminPlanResponse,
  toPlanResponse,
  toPublicPlanResponse,
  type AdminPlanListResponse,
  type AdminPlanResponse,
  type PlanListResponse,
  type PlanWithUnits,
  type PublicPlanListResponse,
} from './types/plan.response';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async listPublicPlans(): Promise<PublicPlanListResponse> {
    try {
      const plans = await this.prismaService.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: PLAN_WITH_UNITS_INCLUDE,
      });

      return {
        plans: plans.map((plan) =>
          toPublicPlanResponse(plan as PlanWithUnits),
        ),
      };
    } catch (error) {
      this.logger.error('Failed to list public plans', error);
      throw error;
    }
  }

  async listActivePlans(user: User): Promise<PlanListResponse> {
    try {
      const plans = await this.prismaService.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: PLAN_WITH_UNITS_INCLUDE,
      });

      return {
        plans: plans.map((plan) =>
          toPlanResponse(plan as PlanWithUnits, user.region),
        ),
      };
    } catch (error) {
      this.logger.error('Failed to list active plans', error);
      throw error;
    }
  }

  async listAllPlans(): Promise<AdminPlanListResponse> {
    try {
      const plans = await this.prismaService.subscriptionPlan.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: PLAN_WITH_UNITS_INCLUDE,
      });

      return {
        plans: plans.map((plan) =>
          toAdminPlanResponse(plan as PlanWithUnits),
        ),
      };
    } catch (error) {
      this.logger.error('Failed to list all plans', error);
      throw error;
    }
  }

  async createPlan(input: unknown): Promise<AdminPlanResponse> {
    let validatedInput: CreatePlanInput;

    try {
      validatedInput = createPlanSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate create plan payload', error);
      throw error;
    }

    try {
      const plan = await this.prismaService.$transaction(async (tx) => {
        await this.assertUnitsExist(tx, validatedInput.unitIds);

        return tx.subscriptionPlan.create({
          data: {
            name: validatedInput.name,
            description: validatedInput.description,
            priceGaza: validatedInput.priceGaza,
            priceWestBank: validatedInput.priceWestBank,
            currency: validatedInput.currency,
            accessEndsAt: validatedInput.accessEndsAt,
            startsAt: validatedInput.startsAt ?? null,
            sortOrder: validatedInput.sortOrder,
            units: {
              create: validatedInput.unitIds.map((unitId) => ({ unitId })),
            },
          },
          include: PLAN_WITH_UNITS_INCLUDE,
        });
      });

      return toAdminPlanResponse(plan as PlanWithUnits);
    } catch (error) {
      this.logger.error('Failed to create plan', error);
      throw error;
    }
  }

  async updatePlan(planId: string, input: unknown): Promise<AdminPlanResponse> {
    let validatedInput: UpdatePlanInput;

    try {
      validatedInput = updatePlanSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate update plan payload', error);
      throw error;
    }

    try {
      const existingPlan = await this.prismaService.subscriptionPlan.findUnique(
        {
          where: { id: planId },
        },
      );

      if (!existingPlan) {
        throw new NotFoundException('Plan not found');
      }

      const plan = await this.prismaService.$transaction(async (tx) => {
        const { unitIds, ...planData } = validatedInput;

        if (unitIds) {
          await this.assertUnitsExist(tx, unitIds);
        }

        await tx.subscriptionPlan.update({
          where: { id: planId },
          data: planData,
        });

        if (unitIds) {
          await tx.planUnit.deleteMany({ where: { planId } });
          await tx.planUnit.createMany({
            data: unitIds.map((unitId) => ({ planId, unitId })),
          });
        }

        return tx.subscriptionPlan.findUniqueOrThrow({
          where: { id: planId },
          include: PLAN_WITH_UNITS_INCLUDE,
        });
      });

      return toAdminPlanResponse(plan as PlanWithUnits);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to update plan ${planId}`, error);
      throw error;
    }
  }

  private async assertUnitsExist(
    tx: Prisma.TransactionClient,
    unitIds: string[],
  ): Promise<void> {
    const uniqueIds = [...new Set(unitIds)];
    const units = await tx.unit.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });

    if (units.length !== uniqueIds.length) {
      throw new BadRequestException('One or more units were not found');
    }
  }
}
