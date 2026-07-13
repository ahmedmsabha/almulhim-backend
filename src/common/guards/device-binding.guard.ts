import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DeviceHashService } from '../../lib/devices/device-hash.service';
import { PrismaService } from '../../lib/database/prisma.service';
import { parseDeviceHeaders } from '../utils/device-header.util';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';

@Injectable()
export class DeviceBindingGuard implements CanActivate {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly deviceHashService: DeviceHashService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }

    const { deviceIdentifier, deviceType } = parseDeviceHeaders(request.headers);
    const deviceHash = this.deviceHashService.hash(deviceIdentifier);

    try {
      const binding = await this.prismaService.deviceBinding.findUnique({
        where: {
          userId_deviceType: {
            userId: request.user.id,
            deviceType,
          },
        },
      });

      if (!binding) {
        throw new ForbiddenException('Device is not bound for this device type');
      }

      if (binding.deviceHash !== deviceHash) {
        throw new ForbiddenException('Device binding mismatch');
      }

      request.device = {
        deviceType,
        deviceIdentifier,
        deviceHash,
      };

      return true;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw error;
    }
  }
}
