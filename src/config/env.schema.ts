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
    POSTHOG_API_KEY: z.string().min(1).optional(),
    POSTHOG_HOST: z.string().url().optional(),

    ARCJET_ENABLED: booleanFromEnv.default(false),
    ARCJET_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.POSTHOG_ENABLED) {
      if (!env.POSTHOG_API_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['POSTHOG_API_KEY'],
          message: 'POSTHOG_API_KEY is required when POSTHOG_ENABLED is true',
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
  });

export type AppEnv = z.infer<typeof appEnvSchema>;
