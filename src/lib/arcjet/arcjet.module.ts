import { Module } from '@nestjs/common';
import { ArcjetService } from './arcjet.service';

@Module({
  providers: [ArcjetService],
  exports: [ArcjetService],
})
export class ArcjetModule {}
