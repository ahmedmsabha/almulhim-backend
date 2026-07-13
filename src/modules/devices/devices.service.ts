import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { ZodError } from 'zod';
import type { DeviceBinding, User } from '../../generated/prisma/client';
import { AnalyticsService } from '../../lib/analytics/analytics.service';
import { DeviceHashService } from '../../lib/devices/device-hash.service';
import { PrismaService } from '../../lib/database/prisma.service';
import { bindDeviceSchema, type BindDeviceInput } from './schemas/device.schemas';
import {
  toDeviceBindingResponse,
  toDeviceHeartbeatResponse,
  toDeviceStatusResponse,
  type DeviceBindingResponse,
  type DeviceHeartbeatResponse,
  type DeviceStatusResponse,
} from './types/device.response';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly deviceHashService: DeviceHashService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async bind(user: User, input: unknown): Promise<DeviceBindingResponse> {
    const validatedInput = this.parseBindInput(input);
    const deviceHash = this.deviceHashService.hash(
      validatedInput.deviceIdentifier,
    );

    try {
      const existingBinding = await this.prismaService.deviceBinding.findUnique({
        where: {
          userId_deviceType: {
            userId: user.id,
            deviceType: validatedInput.deviceType,
          },
        },
      });

      if (!existingBinding) {
        try {
          const created = await this.prismaService.deviceBinding.create({
            data: {
              userId: user.id,
              deviceType: validatedInput.deviceType,
              deviceHash,
              lastSeenAt: new Date(),
            },
          });

          this.analyticsService.captureDeviceBound(user.id, {
            deviceType: created.deviceType,
          });

          return toDeviceBindingResponse(created);
        } catch (error) {
          if (
            error instanceof PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            return this.handleConcurrentBind(
              user.id,
              validatedInput.deviceType,
              deviceHash,
            );
          }

          throw error;
        }
      }

      return this.refreshExistingBinding(existingBinding, deviceHash);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof ZodError) {
        throw error;
      }

      this.logger.error(`Failed to bind device for user ${user.id}`, error);
      throw error;
    }
  }

  private async handleConcurrentBind(
    userId: string,
    deviceType: BindDeviceInput['deviceType'],
    deviceHash: string,
  ): Promise<DeviceBindingResponse> {
    const binding = await this.prismaService.deviceBinding.findUnique({
      where: {
        userId_deviceType: {
          userId,
          deviceType,
        },
      },
    });

    if (!binding) {
      throw new ConflictException(
        'This device type is already bound to another device',
      );
    }

    return this.refreshExistingBinding(binding, deviceHash);
  }

  private async refreshExistingBinding(
    existingBinding: DeviceBinding,
    deviceHash: string,
  ): Promise<DeviceBindingResponse> {
    if (existingBinding.deviceHash !== deviceHash) {
      throw new ConflictException(
        'This device type is already bound to another device',
      );
    }

    const updated = await this.prismaService.deviceBinding.update({
      where: { id: existingBinding.id },
      data: { lastSeenAt: new Date() },
    });

    return toDeviceBindingResponse(updated);
  }

  async getStatus(user: User): Promise<DeviceStatusResponse> {
    try {
      const bindings = await this.prismaService.deviceBinding.findMany({
        where: { userId: user.id },
      });

      return toDeviceStatusResponse(bindings);
    } catch (error) {
      this.logger.error(`Failed to load device status for user ${user.id}`, error);
      throw error;
    }
  }

  async heartbeat(
    request: AuthenticatedRequest,
  ): Promise<DeviceHeartbeatResponse> {
    if (!request.user || !request.device) {
      throw new NotFoundException('Device context is missing');
    }

    try {
      const updated = await this.prismaService.deviceBinding.update({
        where: {
          userId_deviceType: {
            userId: request.user.id,
            deviceType: request.device.deviceType,
          },
        },
        data: { lastSeenAt: new Date() },
      });

      return toDeviceHeartbeatResponse(updated);
    } catch (error) {
      this.logger.error(
        `Failed to record device heartbeat for user ${request.user.id}`,
        error,
      );
      throw error;
    }
  }

  private parseBindInput(input: unknown): BindDeviceInput {
    try {
      return bindDeviceSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      this.logger.error('Failed to validate bind device payload', error);
      throw error;
    }
  }
}
