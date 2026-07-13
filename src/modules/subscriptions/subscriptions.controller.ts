import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { ArcjetProtect } from '../../common/decorators/arcjet-protect.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresRegistration } from '../../common/decorators/requires-registration.decorator';
import type { User } from '../../generated/prisma/client';
import { SubscriptionsService } from './subscriptions.service';
import type {
  ReceiptUploadUrlResponse,
  SubscriptionResponse,
} from './types/subscription.response';

@Controller('subscriptions')
@RequiresRegistration({ studentOnly: true })
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @ArcjetProtect('receipt-upload-url')
  @Post('receipt-upload-url')
  async createReceiptUploadUrl(
    @CurrentUser() user: User,
    @Body() body: unknown,
  ): Promise<ReceiptUploadUrlResponse> {
    try {
      return await this.subscriptionsService.createReceiptUploadUrl(user, body);
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

  @ArcjetProtect('receipt-submit')
  @Post()
  async submitSubscription(
    @CurrentUser() user: User,
    @Body() body: unknown,
  ): Promise<SubscriptionResponse> {
    try {
      return await this.subscriptionsService.submitSubscription(user, body);
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
    @CurrentUser() user: User,
  ): Promise<SubscriptionResponse> {
    return this.subscriptionsService.getMySubscription(user);
  }
}
