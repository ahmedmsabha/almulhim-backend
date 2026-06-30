import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { ClerkUserId } from '../../common/decorators/clerk-user-id.decorator';
import { SubscriptionsService } from './subscriptions.service';
import type {
  ReceiptUploadUrlResponse,
  SubscriptionResponse,
} from './types/subscription.response';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('receipt-upload-url')
  async createReceiptUploadUrl(
    @ClerkUserId() clerkUserId: string,
    @Body() body: unknown,
  ): Promise<ReceiptUploadUrlResponse> {
    try {
      return await this.subscriptionsService.createReceiptUploadUrl(
        clerkUserId,
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

  @Post()
  async submitSubscription(
    @ClerkUserId() clerkUserId: string,
    @Body() body: unknown,
  ): Promise<SubscriptionResponse> {
    try {
      return await this.subscriptionsService.submitSubscription(
        clerkUserId,
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

  @Get('me')
  async getMySubscription(
    @ClerkUserId() clerkUserId: string,
  ): Promise<SubscriptionResponse> {
    return this.subscriptionsService.getMySubscription(clerkUserId);
  }
}
