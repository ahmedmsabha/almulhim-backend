import { appEnvSchema, type AppEnv } from './env.schema';

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const result = appEnvSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  return result.data;
}
