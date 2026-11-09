import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NOTIFICATION_PORT: z.coerce.number().int().min(1).max(65_535).default(3003),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  REDIS_QUEUE_URL: z.string().url().default('redis://redis-queue:6379'),
  NOTIFICATION_QUEUE_NAME: z.string().default('notifications'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),

  SMTP_HOST: z.string().default('mailpit'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),

  MAIL_FROM: z.string().email().default('no-reply@healthcare.local'),
  MAIL_FROM_NAME: z.string().default('Healthcare Scheduling'),
  MAIL_TIMEZONE: z.string().default('Asia/Jakarta'),

  METRICS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  TEMPLATES_DIR: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  return parsed.data;
}
