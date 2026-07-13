import { Module } from '@nestjs/common';
import { ClerkModule } from '../../lib/clerk';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [ClerkModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
