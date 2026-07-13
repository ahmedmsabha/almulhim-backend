import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ArcjetProtectGuard } from '../../common/guards/arcjet-protect.guard';
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard';
import { ClerkModule } from '../../lib/clerk';
import { AuthService } from './auth.service';
import { RegisteredUserGuard } from './guards/registered-user.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [ClerkModule],
  providers: [
    AuthService,
    ClerkAuthGuard,
    ArcjetProtectGuard,
    RegisteredUserGuard,
    RolesGuard,
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ArcjetProtectGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RegisteredUserGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
