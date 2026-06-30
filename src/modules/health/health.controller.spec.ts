jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    $queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '../../config/validate-env';
import { PrismaService } from '../../lib/database/prisma.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

const testEnv: Record<string, string> = {
  PORT: '3000',
  NODE_ENV: 'test',
  LOG_LEVEL: 'info',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/mulhim',
  CLERK_SECRET_KEY: 'sk_test_placeholder',
  CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
  CLERK_JWT_KEY: 'jwt_key_placeholder',
  R2_ACCOUNT_ID: 'account_id',
  R2_ACCESS_KEY_ID: 'access_key',
  R2_SECRET_ACCESS_KEY: 'secret_key',
  R2_BUCKET_NAME: 'mulhim',
  R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
  POSTHOG_ENABLED: 'false',
  ARCJET_ENABLED: 'false',
};

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          validate: (config) => validateEnv({ ...config, ...testEnv }),
        }),
      ],
      controllers: [HealthController],
      providers: [HealthService, PrismaService],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('check', () => {
    it('returns ok status with database up', async () => {
      await expect(healthController.check()).resolves.toEqual({
        status: 'ok',
        environment: 'test',
        database: 'up',
      });
    });
  });
});
