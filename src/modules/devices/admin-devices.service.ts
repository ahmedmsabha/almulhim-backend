import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AnalyticsService } from '../../lib/analytics/analytics.service';
import type { DeviceType } from '../../generated/prisma/client';
import { PrismaService } from '../../lib/database/prisma.service';
import { DownloadsService } from '../downloads/downloads.service';
import { adminDeviceTypeParamSchema } from './schemas/device.schemas';
import {
  toAdminDeviceBindingListResponse,
  type AdminDeviceBindingListResponse,
} from './types/admin-device.response';

@Injectable()
export class AdminDevicesService {
  private readonly logger = new Logger(AdminDevicesService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject(forwardRef(() => DownloadsService))
    private readonly downloadsService: DownloadsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async listBindings(userId: string): Promise<AdminDeviceBindingListResponse> {
    await this.requireStudentUser(userId);

    try {
      const bindings = await this.prismaService.deviceBinding.findMany({
        where: { userId },
        orderBy: { deviceType: 'asc' },
      });

      return toAdminDeviceBindingListResponse(userId, bindings);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to list device bindings for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  async resetBinding(
    userId: string,
    deviceType: string,
    adminClerkId: string,
  ): Promise<AdminDeviceBindingListResponse> {
    const validatedDeviceType = this.parseDeviceType(deviceType);
    await this.requireStudentUser(userId);

    try {
      if (validatedDeviceType === 'mobile') {
        const binding = await this.prismaService.deviceBinding.findUnique({
          where: {
            userId_deviceType: {
              userId,
              deviceType: 'mobile',
            },
          },
        });

        if (binding) {
          await this.downloadsService.revokeDownloads(userId, {
            deviceHash: binding.deviceHash,
          });
        }
      }

      const deleteResult = await this.prismaService.deviceBinding.deleteMany({
        where: {
          userId,
          deviceType: validatedDeviceType,
        },
      });

      if (deleteResult.count > 0) {
        this.analyticsService.captureDeviceReset(userId, {
          deviceType: validatedDeviceType,
          adminClerkId,
        });
      }

      return this.listBindings(userId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to reset ${validatedDeviceType} binding for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  async resetAllBindings(
    userId: string,
    adminClerkId: string,
  ): Promise<AdminDeviceBindingListResponse> {
    await this.requireStudentUser(userId);

    try {
      await this.downloadsService.revokeDownloads(userId);

      const deleteResult = await this.prismaService.deviceBinding.deleteMany({
        where: { userId },
      });

      if (deleteResult.count > 0) {
        this.analyticsService.captureDeviceReset(userId, {
          deviceType: 'all',
          adminClerkId,
        });
      }

      return this.listBindings(userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to reset all device bindings for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  private parseDeviceType(deviceType: string): DeviceType {
    const result = adminDeviceTypeParamSchema.safeParse(deviceType);

    if (!result.success) {
      throw new BadRequestException('deviceType must be web or mobile');
    }

    return result.data;
  }

  private async requireStudentUser(userId: string): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'student') {
      throw new NotFoundException('User not found');
    }
  }
}
