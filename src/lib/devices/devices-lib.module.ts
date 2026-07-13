import { Module } from '@nestjs/common';
import { DeviceHashService } from './device-hash.service';

@Module({
  providers: [DeviceHashService],
  exports: [DeviceHashService],
})
export class DevicesLibModule {}
