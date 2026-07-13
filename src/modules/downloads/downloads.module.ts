import { forwardRef, Module } from '@nestjs/common';
import { DevicesLibModule } from '../../lib/devices';
import { StorageModule } from '../../lib/storage';
import { DevicesModule } from '../devices/devices.module';
import { DownloadsController } from './downloads.controller';
import { DownloadsService } from './downloads.service';

@Module({
  imports: [
    DevicesLibModule,
    forwardRef(() => DevicesModule),
    StorageModule,
  ],
  controllers: [DownloadsController],
  providers: [DownloadsService],
  exports: [DownloadsService],
})
export class DownloadsModule {}
