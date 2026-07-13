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
import { SupportService } from './support.service';
import type {
  SupportRequestListResponse,
  SupportRequestResponse,
} from './types/support.response';

@Controller('support')
@RequiresRegistration({ studentOnly: true })
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @ArcjetProtect('support-create')
  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() body: unknown,
  ): Promise<SupportRequestResponse> {
    try {
      return await this.supportService.create(user, body);
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
  async listMine(
    @CurrentUser() user: User,
  ): Promise<SupportRequestListResponse> {
    return this.supportService.listMine(user);
  }
}
