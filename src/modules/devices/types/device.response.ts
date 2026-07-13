import type {
  DeviceBinding,
  DeviceType,
} from '../../../generated/prisma/client';

export type DeviceSlotStatus = {
  bound: boolean;
  boundAt: string | null;
  lastSeenAt: string | null;
};

export type DeviceStatusResponse = {
  web: DeviceSlotStatus;
  mobile: DeviceSlotStatus;
};

export type DeviceBindingResponse = {
  deviceType: DeviceType;
  boundAt: string;
  lastSeenAt: string;
};

export type DeviceHeartbeatResponse = {
  deviceType: DeviceType;
  lastSeenAt: string;
};

const emptySlotStatus = (): DeviceSlotStatus => ({
  bound: false,
  boundAt: null,
  lastSeenAt: null,
});

const toSlotStatus = (binding: DeviceBinding): DeviceSlotStatus => ({
  bound: true,
  boundAt: binding.boundAt.toISOString(),
  lastSeenAt: binding.lastSeenAt?.toISOString() ?? null,
});

export const toDeviceStatusResponse = (
  bindings: DeviceBinding[],
): DeviceStatusResponse => {
  const response: DeviceStatusResponse = {
    web: emptySlotStatus(),
    mobile: emptySlotStatus(),
  };

  for (const binding of bindings) {
    response[binding.deviceType] = toSlotStatus(binding);
  }

  return response;
};

export const toDeviceBindingResponse = (
  binding: DeviceBinding,
): DeviceBindingResponse => ({
  deviceType: binding.deviceType,
  boundAt: binding.boundAt.toISOString(),
  lastSeenAt: (binding.lastSeenAt ?? binding.boundAt).toISOString(),
});

export const toDeviceHeartbeatResponse = (
  binding: DeviceBinding,
): DeviceHeartbeatResponse => ({
  deviceType: binding.deviceType,
  lastSeenAt: (binding.lastSeenAt ?? binding.boundAt).toISOString(),
});
