import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ArcjetProtect } from '../../common/decorators/arcjet-protect.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClerkUserId } from '../../common/decorators/clerk-user-id.decorator';
import { AdminDevicesService } from './admin-devices.service';
import type { AdminDeviceBindingListResponse } from './types/admin-device.response';

@Roles('admin')
@Controller('devices/admin')
export class AdminDevicesController {
  constructor(private readonly adminDevicesService: AdminDevicesService) {}

  @Get('users/:userId/bindings')
  async listBindings(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<AdminDeviceBindingListResponse> {
    return this.adminDevicesService.listBindings(userId);
  }

  @ArcjetProtect('admin-mutation')
  @Delete('users/:userId/bindings/:deviceType')
  async resetBinding(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('deviceType') deviceType: string,
    @ClerkUserId() adminClerkId: string,
  ): Promise<AdminDeviceBindingListResponse> {
    return this.adminDevicesService.resetBinding(
      userId,
      deviceType,
      adminClerkId,
    );
  }

  @ArcjetProtect('admin-mutation')
  @Delete('users/:userId/bindings')
  async resetAllBindings(
    @Param('userId', ParseUUIDPipe) userId: string,
    @ClerkUserId() adminClerkId: string,
  ): Promise<AdminDeviceBindingListResponse> {
    return this.adminDevicesService.resetAllBindings(userId, adminClerkId);
  }
}
