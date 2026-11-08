import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  it('applies sane defaults for empty config', () => {
    const env = validateEnv({});
    expect(env.NOTIFICATION_PORT).toBe(3003);
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.REDIS_QUEUE_URL).toBe('redis://redis-queue:6379');
    expect(env.NOTIFICATION_QUEUE_NAME).toBe('notifications');
    expect(env.SMTP_HOST).toBe('mailpit');
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.MAIL_FROM).toBe('no-reply@healthcare.local');
    expect(env.METRICS_ENABLED).toBe(true);
  });

  it('accepts valid overrides', () => {
    const env = validateEnv({
      NOTIFICATION_PORT: '8080',
      NODE_ENV: 'production',
      SMTP_PORT: '587',
      SMTP_SECURE: 'true',
      MAIL_FROM: 'clinic@hospital.com',
      METRICS_ENABLED: 'false',
    });
    expect(env.NOTIFICATION_PORT).toBe(8080);
    expect(env.NODE_ENV).toBe('production');
    expect(env.SMTP_PORT).toBe(587);
    expect(env.SMTP_SECURE).toBe(true);
    expect(env.MAIL_FROM).toBe('clinic@hospital.com');
    expect(env.METRICS_ENABLED).toBe(false);
  });

  it('throws on invalid port', () => {
    expect(() => validateEnv({ NOTIFICATION_PORT: '-1' })).toThrow();
  });

  it('throws on invalid email', () => {
    expect(() => validateEnv({ MAIL_FROM: 'not-an-email' })).toThrow();
  });
});
