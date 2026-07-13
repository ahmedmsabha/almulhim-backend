import { Module } from '@nestjs/common';
import { MailModule } from '../../lib/mail';
import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [MailModule],
  controllers: [AdminSupportController, SupportController],
  providers: [AdminSupportService, SupportService],
  exports: [AdminSupportService, SupportService],
})
export class SupportModule {}
