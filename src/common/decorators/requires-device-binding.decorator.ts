import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { REQUIRES_DEVICE_BINDING_KEY } from '../constants/auth-metadata';
import { DeviceBindingGuard } from '../guards/device-binding.guard';

export const RequiresDeviceBinding = () =>
  applyDecorators(
    SetMetadata(REQUIRES_DEVICE_BINDING_KEY, true),
    UseGuards(DeviceBindingGuard),
  );
