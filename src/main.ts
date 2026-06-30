import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { AppEnv } from './config/env.schema';

async function bootstrap(): Promise<void> {
  try {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService<AppEnv, true>);
    const port = configService.get('PORT', { infer: true });
    const logLevel = configService.get('LOG_LEVEL', { infer: true });

    await app.listen(port);
    console.log(`Application listening on port ${port} (${logLevel})`);
  } catch (error) {
    console.error('Failed to start application', error);
    process.exit(1);
  }
}

void bootstrap();
