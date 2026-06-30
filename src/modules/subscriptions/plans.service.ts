import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  toAdminPlanResponse,
  toPlanResponse,
  toPublicPlanResponse,
  type AdminPlanListResponse,
  type AdminPlanResponse,
  type PlanListResponse,
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
      });

      return {
        plans: plans.map(toPublicPlanResponse),
      };
    } catch (error) {
      this.logger.error('Failed to list public plans', error);
      throw error;
    }
  }

  async listActivePlans(): Promise<PlanListResponse> {
    try {
      const plans = await this.prismaService.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });

      return {
        plans: plans.map(toPlanResponse),
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
      });

      return {
        plans: plans.map(toAdminPlanResponse),
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
      const plan = await this.prismaService.subscriptionPlan.create({
        data: {
          name: validatedInput.name,
          description: validatedInput.description,
          priceAmount: validatedInput.priceAmount,
          currency: validatedInput.currency,
          durationDays: validatedInput.durationDays,
          sortOrder: validatedInput.sortOrder,
        },
      });

      return toAdminPlanResponse(plan);
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

      const plan = await this.prismaService.subscriptionPlan.update({
        where: { id: planId },
        data: validatedInput,
      });

      return toAdminPlanResponse(plan);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to update plan ${planId}`, error);
      throw error;
    }
  }
}
