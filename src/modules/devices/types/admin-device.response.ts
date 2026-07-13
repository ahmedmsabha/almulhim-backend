import type { DeviceBinding, DeviceType } from '../../../generated/prisma/client';

export type AdminDeviceBindingResponse = {
  deviceType: DeviceType;
  boundAt: string;
  lastSeenAt: string | null;
};

export type AdminDeviceBindingListResponse = {
  userId: string;
  bindings: AdminDeviceBindingResponse[];
};

export const toAdminDeviceBindingResponse = (
  binding: DeviceBinding,
): AdminDeviceBindingResponse => ({
  deviceType: binding.deviceType,
  boundAt: binding.boundAt.toISOString(),
  lastSeenAt: binding.lastSeenAt?.toISOString() ?? null,
});

export const toAdminDeviceBindingListResponse = (
  userId: string,
  bindings: DeviceBinding[],
): AdminDeviceBindingListResponse => ({
  userId,
  bindings: bindings.map(toAdminDeviceBindingResponse),
});
