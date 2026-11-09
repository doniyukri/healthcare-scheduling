import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    AUTH_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),

    DATABASE_URL: z.string().min(1).optional(),
    AUTH_DATABASE_URL: z.string().min(1).optional(),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('1h'),
    JWT_ISSUER: z.string().default('healthcare-auth'),
    JWT_AUDIENCE: z.string().default('healthcare-api'),

    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CORS_ORIGIN: z.string().default('*'),

    AUTH_THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
    AUTH_THROTTLE_LIMIT: z.coerce.number().int().positive().default(5),
  })
  .superRefine((value, ctx) => {
    if (!value.DATABASE_URL && !value.AUTH_DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL or AUTH_DATABASE_URL is required',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Validates the process environment at boot. The service refuses to start with
 * a missing or weak configuration instead of failing later at request time.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  // Prisma and the adapter read DATABASE_URL directly. Normalize the per-service
  // variable into the shared name so one container sees only its own database.
  if (!parsed.data.DATABASE_URL && parsed.data.AUTH_DATABASE_URL) {
    process.env.DATABASE_URL = parsed.data.AUTH_DATABASE_URL;
  }

  return parsed.data;
}
