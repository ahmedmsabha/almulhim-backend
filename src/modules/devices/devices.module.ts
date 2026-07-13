import { forwardRef, Module } from '@nestjs/common';
import { DeviceBindingGuard } from '../../common/guards/device-binding.guard';
import { DevicesLibModule } from '../../lib/devices';
import { DownloadsModule } from '../downloads/downloads.module';
import { AdminDevicesController } from './admin-devices.controller';
import { AdminDevicesService } from './admin-devices.service';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [DevicesLibModule, forwardRef(() => DownloadsModule)],
  controllers: [DevicesController, AdminDevicesController],
  providers: [DevicesService, AdminDevicesService, DeviceBindingGuard],
  exports: [
    DevicesLibModule,
    DevicesService,
    AdminDevicesService,
    DeviceBindingGuard,
  ],
})
export class DevicesModule {}
