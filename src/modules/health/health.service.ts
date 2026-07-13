import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.schema';
import { PrismaService } from '../../lib/database/prisma.service';

export type HealthResponse = {
  status: 'ok';
  environment: AppEnv['NODE_ENV'];
  database: 'up';
};

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly prismaService: PrismaService,
  ) {}

  async check(): Promise<HealthResponse> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        database: 'down',
      });
    }

    return {
      status: 'ok',
      environment: this.configService.get('NODE_ENV', { infer: true }),
      database: 'up',
    };
  }
}
