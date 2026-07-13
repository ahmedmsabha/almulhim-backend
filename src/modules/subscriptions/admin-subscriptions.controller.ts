import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { ArcjetProtect } from '../../common/decorators/arcjet-protect.decorator';
import { ClerkUserId } from '../../common/decorators/clerk-user-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import type {
  AdminSubscriptionListResponse,
  AdminSubscriptionResponse,
  ReceiptUrlResponse,
} from './types/admin-subscription.response';
import type { AiVerificationLogListResponse } from './types/ai-verification-log.response';

@Roles('admin')
@Controller('subscriptions')
export class AdminSubscriptionsController {
  constructor(
    private readonly adminSubscriptionsService: AdminSubscriptionsService,
  ) {}

  @Get('pending')
  async listPending(): Promise<AdminSubscriptionListResponse> {
    return this.adminSubscriptionsService.listPending();
  }

  /**
   * Non-pending decided subscriptions (`active` | `rejected` | `suspended` | `expired`).
   * Ordered by `updatedAt` desc. Registered before `:id` so "archived" is not parsed as UUID.
   */
  @Get('archived')
  async listArchived(): Promise<AdminSubscriptionListResponse> {
    return this.adminSubscriptionsService.listArchived();
  }

  /**
   * Receipt AI verification runs (`verificationResult` / `verifiedAt`).
   * Registered before `:id` so "ai-logs" is not parsed as UUID.
   */
  @Get('ai-logs')
  async listAiLogs(): Promise<AiVerificationLogListResponse> {
    return this.adminSubscriptionsService.listAiLogs();
  }

  @ArcjetProtect('admin-mutation')
  @Get(':id/receipt-url')
  async getReceiptUrl(
    @Param('id', ParseUUIDPipe) subscriptionId: string,
  ): Promise<ReceiptUrlResponse> {
    return this.adminSubscriptionsService.getReceiptUrl(subscriptionId);
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id/approve')
  async approveSubscription(
    @Param('id', ParseUUIDPipe) subscriptionId: string,
    @ClerkUserId() adminClerkId: string,
  ): Promise<AdminSubscriptionResponse> {
    return this.adminSubscriptionsService.approveSubscription(
      subscriptionId,
      adminClerkId,
    );
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id/reject')
  async rejectSubscription(
    @Param('id', ParseUUIDPipe) subscriptionId: string,
    @ClerkUserId() adminClerkId: string,
    @Body() body: unknown,
  ): Promise<AdminSubscriptionResponse> {
    try {
      return await this.adminSubscriptionsService.rejectSubscription(
        subscriptionId,
        adminClerkId,
        body,
      );
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

  @ArcjetProtect('admin-mutation')
  @Patch(':id/suspend')
  async suspendSubscription(
    @Param('id', ParseUUIDPipe) subscriptionId: string,
    @ClerkUserId() adminClerkId: string,
  ): Promise<AdminSubscriptionResponse> {
    return this.adminSubscriptionsService.suspendSubscription(
      subscriptionId,
      adminClerkId,
    );
  }

  /**
   * Single-subscription admin read (any status). Same DTO as pending-list rows.
   * Does not include receipt binary or a permanent storage URL —
   * use GET /subscriptions/:id/receipt-url for signed receipt viewing.
   */
  @Get(':id')
  async getSubscriptionById(
    @Param('id', ParseUUIDPipe) subscriptionId: string,
  ): Promise<AdminSubscriptionResponse> {
    return this.adminSubscriptionsService.getSubscriptionById(subscriptionId);
  }
}
