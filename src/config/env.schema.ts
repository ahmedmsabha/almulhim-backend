import { z } from 'zod';

const booleanFromEnv = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

export const appEnvSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    DATABASE_URL: z.string().min(1),

    CLERK_SECRET_KEY: z.string().min(1),
    CLERK_PUBLISHABLE_KEY: z.string().min(1),
    CLERK_JWT_KEY: z.string().min(1),

    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET_NAME: z.string().min(1),
    R2_PUBLIC_BASE_URL: z.string().url(),

    POSTHOG_ENABLED: booleanFromEnv.default(false),
    POSTHOG_PROJECT_TOKEN: z.string().min(1).optional(),
    POSTHOG_HOST: z.string().url().optional(),

    ARCJET_ENABLED: booleanFromEnv.default(false),
    ARCJET_KEY: z.string().min(1).optional(),

    AI_PROVIDER: z.enum(['gemini']).default('gemini'),
    RECEIPT_AI_ENABLED: booleanFromEnv.default(false),
    CONTENT_SEARCH_AI_ENABLED: booleanFromEnv.default(false),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    EXPECTED_RECIPIENT_NAMES: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name.length > 0),
      ),

    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      ),

    CLERK_AUTHORIZED_PARTIES: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((party) => party.trim())
          .filter((party) => party.length > 0),
      ),

    MAIL_ENABLED: booleanFromEnv.default(false),
    MAIL_FROM: z.string().email().optional(),
    TEACHER_SUPPORT_EMAIL: z.string().email().optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_SECURE: booleanFromEnv.optional(),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),

    DEVICE_HASH_PEPPER: z.string().min(16),

    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),

    /** Keep false until Mobile registers Expo push tokens. In-app Notification rows are created regardless. */
    PUSH_NOTIFICATIONS_ENABLED: booleanFromEnv.default(false),
  })
  .superRefine((env, ctx) => {
    if (env.POSTHOG_ENABLED) {
      if (!env.POSTHOG_PROJECT_TOKEN) {
        ctx.addIssue({
          code: 'custom',
          path: ['POSTHOG_PROJECT_TOKEN'],
          message:
            'POSTHOG_PROJECT_TOKEN is required when POSTHOG_ENABLED is true',
        });
      }

      if (!env.POSTHOG_HOST) {
        ctx.addIssue({
          code: 'custom',
          path: ['POSTHOG_HOST'],
          message: 'POSTHOG_HOST is required when POSTHOG_ENABLED is true',
        });
      }
    }

    if (env.ARCJET_ENABLED && !env.ARCJET_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ARCJET_KEY'],
        message: 'ARCJET_KEY is required when ARCJET_ENABLED is true',
      });
    }

    if (env.RECEIPT_AI_ENABLED) {
      if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['GOOGLE_GENERATIVE_AI_API_KEY'],
          message:
            'GOOGLE_GENERATIVE_AI_API_KEY is required when RECEIPT_AI_ENABLED is true',
        });
      }

      if (env.EXPECTED_RECIPIENT_NAMES.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['EXPECTED_RECIPIENT_NAMES'],
          message:
            'EXPECTED_RECIPIENT_NAMES is required when RECEIPT_AI_ENABLED is true',
        });
      }
    }

    if (env.CONTENT_SEARCH_AI_ENABLED && !env.GOOGLE_GENERATIVE_AI_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_GENERATIVE_AI_API_KEY'],
        message:
          'GOOGLE_GENERATIVE_AI_API_KEY is required when CONTENT_SEARCH_AI_ENABLED is true',
      });
    }

    if (env.MAIL_ENABLED) {
      const mailFields = [
        ['MAIL_FROM', env.MAIL_FROM],
        ['TEACHER_SUPPORT_EMAIL', env.TEACHER_SUPPORT_EMAIL],
        ['SMTP_HOST', env.SMTP_HOST],
        ['SMTP_PORT', env.SMTP_PORT],
        ['SMTP_USER', env.SMTP_USER],
        ['SMTP_PASS', env.SMTP_PASS],
      ] as const;

      for (const [path, value] of mailFields) {
        if (value === undefined || value === '') {
          ctx.addIssue({
            code: 'custom',
            path: [path],
            message: `${path} is required when MAIL_ENABLED is true`,
          });
        }
      }

      if (env.SMTP_SECURE === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['SMTP_SECURE'],
          message: 'SMTP_SECURE is required when MAIL_ENABLED is true',
        });
      }
    }

    if (env.NODE_ENV === 'production') {
      if (env.CORS_ORIGINS.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: 'CORS_ORIGINS is required when NODE_ENV is production',
        });
      }

      if (env.CLERK_AUTHORIZED_PARTIES.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['CLERK_AUTHORIZED_PARTIES'],
          message:
            'CLERK_AUTHORIZED_PARTIES is required when NODE_ENV is production',
        });
      }
    }
  });

export type AppEnv = z.infer<typeof appEnvSchema>;
