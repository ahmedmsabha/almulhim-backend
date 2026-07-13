import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { ArcjetProtect } from '../../common/decorators/arcjet-protect.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresDeviceBinding } from '../../common/decorators/requires-device-binding.decorator';
import { RequiresRegistration } from '../../common/decorators/requires-registration.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import type { User } from '../../generated/prisma/client';
import { DevicesService } from './devices.service';
import type {
  DeviceBindingResponse,
  DeviceHeartbeatResponse,
  DeviceStatusResponse,
} from './types/device.response';

@Controller('devices')
@RequiresRegistration({ studentOnly: true })
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @ArcjetProtect('device-bind')
  @Post('bind')
  async bind(
    @CurrentUser() user: User,
    @Body() body: unknown,
  ): Promise<DeviceBindingResponse> {
    return this.handleWrite(() => this.devicesService.bind(user, body));
  }

  @Get('me')
  async getStatus(@CurrentUser() user: User): Promise<DeviceStatusResponse> {
    return this.devicesService.getStatus(user);
  }

  @Post('heartbeat')
  @RequiresDeviceBinding()
  async heartbeat(
    @Req() request: AuthenticatedRequest,
  ): Promise<DeviceHeartbeatResponse> {
    return this.devicesService.heartbeat(request);
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
