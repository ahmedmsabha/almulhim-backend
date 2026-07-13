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
  DEVICE_HASH_PEPPER: 'local-dev-pepper-min-16-chars',
};

describe('appEnvSchema', () => {
  it('accepts valid env with PostHog and Arcjet disabled', () => {
    const result = appEnvSchema.safeParse(baseEnv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.POSTHOG_ENABLED).toBe(false);
      expect(result.data.ARCJET_ENABLED).toBe(false);
      expect(result.data.SIGNED_URL_TTL_SECONDS).toBe(900);
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
      expect(paths).toContain('POSTHOG_PROJECT_TOKEN');
      expect(paths).toContain('POSTHOG_HOST');
    }
  });

  it('accepts PostHog keys when POSTHOG_ENABLED is true', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      POSTHOG_ENABLED: 'true',
      POSTHOG_PROJECT_TOKEN: 'phc_test',
      POSTHOG_HOST: 'https://eu.i.posthog.com',
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

  it('requires Gemini config when RECEIPT_AI_ENABLED is true', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      RECEIPT_AI_ENABLED: 'true',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('GOOGLE_GENERATIVE_AI_API_KEY');
      expect(paths).toContain('EXPECTED_RECIPIENT_NAMES');
    }
  });

  it('accepts Gemini config when RECEIPT_AI_ENABLED is true', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      RECEIPT_AI_ENABLED: 'true',
      GOOGLE_GENERATIVE_AI_API_KEY: 'google_api_key',
      EXPECTED_RECIPIENT_NAMES: 'Teacher Name, Alt Name',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.RECEIPT_AI_ENABLED).toBe(true);
      expect(result.data.EXPECTED_RECIPIENT_NAMES).toEqual([
        'Teacher Name',
        'Alt Name',
      ]);
    }
  });

  it('requires Gemini API key when CONTENT_SEARCH_AI_ENABLED is true', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      CONTENT_SEARCH_AI_ENABLED: 'true',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('GOOGLE_GENERATIVE_AI_API_KEY');
    }
  });

  it('accepts CONTENT_SEARCH_AI_ENABLED with Gemini API key (no recipient names)', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      CONTENT_SEARCH_AI_ENABLED: 'true',
      GOOGLE_GENERATIVE_AI_API_KEY: 'google_api_key',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.CONTENT_SEARCH_AI_ENABLED).toBe(true);
    }
  });

  it('requires mail config when MAIL_ENABLED is true', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      MAIL_ENABLED: 'true',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('MAIL_FROM');
      expect(paths).toContain('TEACHER_SUPPORT_EMAIL');
      expect(paths).toContain('SMTP_HOST');
      expect(paths).toContain('SMTP_PORT');
      expect(paths).toContain('SMTP_SECURE');
      expect(paths).toContain('SMTP_USER');
      expect(paths).toContain('SMTP_PASS');
    }
  });

  it('accepts mail config when MAIL_ENABLED is true', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      MAIL_ENABLED: 'true',
      MAIL_FROM: 'noreply@example.com',
      TEACHER_SUPPORT_EMAIL: 'teacher@example.com',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'smtp-user',
      SMTP_PASS: 'smtp-pass',
    });

    expect(result.success).toBe(true);
  });

  it('requires DEVICE_HASH_PEPPER with at least 16 characters', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      DEVICE_HASH_PEPPER: 'short',
    });

    expect(result.success).toBe(false);
  });

  it('requires CORS_ORIGINS and CLERK_AUTHORIZED_PARTIES in production', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('CORS_ORIGINS');
      expect(paths).toContain('CLERK_AUTHORIZED_PARTIES');
    }
  });

  it('accepts production env when CORS and authorized parties are set', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://app.example.com',
      CLERK_AUTHORIZED_PARTIES: 'https://app.example.com',
    });

    expect(result.success).toBe(true);
  });

  it('defaults PUSH_NOTIFICATIONS_ENABLED to false', () => {
    const result = appEnvSchema.safeParse(baseEnv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PUSH_NOTIFICATIONS_ENABLED).toBe(false);
    }
  });

  it('accepts PUSH_NOTIFICATIONS_ENABLED=true', () => {
    const result = appEnvSchema.safeParse({
      ...baseEnv,
      PUSH_NOTIFICATIONS_ENABLED: 'true',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PUSH_NOTIFICATIONS_ENABLED).toBe(true);
    }
  });
});
