import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlansService } from './plans.service';
import {
  type AdminPlanListResponse,
  type AdminPlanResponse,
  type PlanListResponse,
  type PublicPlanListResponse,
} from './types/plan.response';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Public()
  @Get('public')
  async listPublicPlans(): Promise<PublicPlanListResponse> {
    return this.plansService.listPublicPlans();
  }

  @Roles('admin')
  @Get('all')
  async listAllPlans(): Promise<AdminPlanListResponse> {
    return this.plansService.listAllPlans();
  }

  @Get()
  async listActivePlans(): Promise<PlanListResponse> {
    return this.plansService.listActivePlans();
  }

  @Roles('admin')
  @Post()
  async createPlan(@Body() body: unknown): Promise<AdminPlanResponse> {
    try {
      return await this.plansService.createPlan(body);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.flatten(),
        });
      }

      throw error;
    }
  }

  @Roles('admin')
  @Patch(':id')
  async updatePlan(
    @Param('id', ParseUUIDPipe) planId: string,
    @Body() body: unknown,
  ): Promise<AdminPlanResponse> {
    try {
      return await this.plansService.updatePlan(planId, body);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.flatten(),
        });
      }

      throw error;
    }
  }
}
