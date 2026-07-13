import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { ArcjetProtect } from '../../common/decorators/arcjet-protect.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminSupportService } from './admin-support.service';
import type {
  AdminSupportRequestListResponse,
  AdminSupportRequestResponse,
} from './types/admin-support.response';

@Roles('admin')
@Controller('support/admin')
export class AdminSupportController {
  constructor(private readonly adminSupportService: AdminSupportService) {}

  @Get('requests')
  async listRequests(
    @Query() query: unknown,
  ): Promise<AdminSupportRequestListResponse> {
    return this.handleWrite(() => this.adminSupportService.listRequests(query));
  }

  @Get('requests/:id')
  async getRequest(
    @Param('id', ParseUUIDPipe) requestId: string,
  ): Promise<AdminSupportRequestResponse> {
    return this.adminSupportService.getRequest(requestId);
  }

  @ArcjetProtect('admin-mutation')
  @Patch('requests/:id/reply')
  async reply(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() body: unknown,
  ): Promise<AdminSupportRequestResponse> {
    return this.handleWrite(() =>
      this.adminSupportService.reply(requestId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Patch('requests/:id/close')
  async close(
    @Param('id', ParseUUIDPipe) requestId: string,
  ): Promise<AdminSupportRequestResponse> {
    return this.adminSupportService.close(requestId);
  }

  private async handleWrite<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
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
