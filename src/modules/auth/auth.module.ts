import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClerkModule } from '../../lib/clerk';
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [ClerkModule],
  providers: [
    AuthService,
    ClerkAuthGuard,
    RolesGuard,
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
