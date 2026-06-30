import { appEnvSchema } from './env.schema';

const baseEnv = {
  PORT: '3000',
  NODE_ENV: 'development',
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

describe('appEnvSchema', () => {
  it('accepts valid env with PostHog and Arcjet disabled', () => {
    const result = appEnvSchema.safeParse(baseEnv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.POSTHOG_ENABLED).toBe(false);
      expect(result.data.ARCJET_ENABLED).toBe(false);
    }
  });

  it('requires PostHog keys when POSTHOG_ENABLED is true', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      POSTHOG_ENABLED: 'true',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('POSTHOG_API_KEY');
      expect(paths).toContain('POSTHOG_HOST');
    }
  });

  it('accepts PostHog keys when POSTHOG_ENABLED is true', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      POSTHOG_ENABLED: 'true',
      POSTHOG_API_KEY: 'phc_test',
      POSTHOG_HOST: 'https://us.i.posthog.com',
    });

    expect(result.success).toBe(true);
  });

  it('requires ARCJET_KEY when ARCJET_ENABLED is true', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      ARCJET_ENABLED: 'true',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('ARCJET_KEY');
    }
  });

  it('rejects empty R2_PUBLIC_BASE_URL', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      R2_PUBLIC_BASE_URL: '',
    });

    expect(result.success).toBe(false);
  });
});
