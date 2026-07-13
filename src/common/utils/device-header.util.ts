import { BadRequestException } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'http';
import type { DeviceType } from '../../generated/prisma/client';
import {
  DEVICE_ID_HEADER,
  DEVICE_TYPE_HEADER,
} from '../constants/device-headers';

export type ParsedDeviceHeaders = {
  deviceIdentifier: string;
  deviceType: DeviceType;
};

const deviceIdentifierSchema = {
  minLength: 16,
  maxLength: 128,
} as const;

const readHeaderValue = (
  headers: IncomingHttpHeaders,
  name: string,
): string | undefined => {
  const value = headers[name];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const parseDeviceHeaders = (
  headers: IncomingHttpHeaders,
): ParsedDeviceHeaders => {
  const deviceIdentifier = readHeaderValue(headers, DEVICE_ID_HEADER);
  const deviceTypeRaw = readHeaderValue(headers, DEVICE_TYPE_HEADER);

  if (!deviceIdentifier) {
    throw new BadRequestException('X-Device-Id header is required');
  }

  if (
    deviceIdentifier.length < deviceIdentifierSchema.minLength ||
    deviceIdentifier.length > deviceIdentifierSchema.maxLength
  ) {
    throw new BadRequestException(
      'X-Device-Id must be between 16 and 128 characters',
    );
  }

  if (deviceTypeRaw !== 'web' && deviceTypeRaw !== 'mobile') {
    throw new BadRequestException(
      'X-Device-Type header must be web or mobile',
    );
  }

  return {
    deviceIdentifier,
    deviceType: deviceTypeRaw,
  };
};
