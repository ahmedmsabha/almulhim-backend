import { Global, Module } from '@nestjs/common';
import { ArcjetService } from './arcjet.service';

@Global()
@Module({
  providers: [ArcjetService],
  exports: [ArcjetService],
})
export class ArcjetModule {}
