import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.schema';

@Injectable()
export class DeviceHashService {
  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  hash(deviceIdentifier: string): string {
    const pepper = this.configService.get('DEVICE_HASH_PEPPER', { infer: true });

    return createHash('sha256')
      .update(`${pepper}${deviceIdentifier}`)
      .digest('hex');
  }
}
