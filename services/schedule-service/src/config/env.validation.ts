import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    SCHEDULE_PORT: z.coerce.number().int().min(1).max(65_535).default(3002),

    DATABASE_URL: z.string().min(1).optional(),
    SCHEDULE_DATABASE_URL: z.string().min(1).optional(),

    AUTH_SERVICE_URL: z.string().url().default('http://auth-service:3001/graphql'),
    AUTH_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
    AUTH_SERVICE_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(1),

    REDIS_CACHE_URL: z.string().url().default('redis://redis-cache:6379'),
    REDIS_QUEUE_URL: z.string().url().default('redis://redis-queue:6379'),
    CACHE_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    CACHE_TTL_MS: z.coerce.number().int().positive().default(60_000),
    CACHE_TTL_JITTER_PERCENT: z.coerce.number().int().min(0).max(50).default(10),
    CACHE_NEGATIVE_TTL_MS: z.coerce.number().int().positive().default(10_000),

    QUEUE_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    NOTIFICATION_QUEUE_NAME: z.string().default('notifications'),

    SCHEDULE_THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
    SCHEDULE_THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

    GRAPHQL_DEPTH_LIMIT: z.coerce.number().int().min(1).max(50).default(10),
    GRAPHQL_INTROSPECTION: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CORS_ORIGIN: z.string().default('*'),
    METRICS_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
  })
  .superRefine((value, ctx) => {
    if (!value.DATABASE_URL && !value.SCHEDULE_DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL or SCHEDULE_DATABASE_URL is required',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Validates the process environment at boot so a misconfigured container fails
 * immediately with a readable message instead of at the first request.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  // Prisma reads DATABASE_URL directly. Normalize the per-service variable so
  // the container only ever sees its own database.
  if (!parsed.data.DATABASE_URL && parsed.data.SCHEDULE_DATABASE_URL) {
    process.env.DATABASE_URL = parsed.data.SCHEDULE_DATABASE_URL;
  }

  return parsed.data;
}
