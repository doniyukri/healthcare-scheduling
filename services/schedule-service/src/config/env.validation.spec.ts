import { validateEnv } from './env.validation.js';

const base = {
  SCHEDULE_DATABASE_URL: 'postgresql://user:pass@localhost:5432/schedule_db',
};

describe('validateEnv', () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it('applies service defaults', () => {
    const env = validateEnv({ ...base });

    expect(env.SCHEDULE_PORT).toBe(3002);
    expect(env.AUTH_SERVICE_URL).toBe('http://auth-service:3001/graphql');
    expect(env.AUTH_SERVICE_TIMEOUT_MS).toBe(2000);
    expect(env.CACHE_TTL_MS).toBe(60_000);
    expect(env.CACHE_ENABLED).toBe(true);
    expect(env.QUEUE_ENABLED).toBe(true);
    expect(env.GRAPHQL_DEPTH_LIMIT).toBe(10);
    expect(env.NOTIFICATION_QUEUE_NAME).toBe('notifications');
  });

  it('coerces numbers and booleans', () => {
    const env = validateEnv({
      ...base,
      SCHEDULE_PORT: '4002',
      AUTH_SERVICE_TIMEOUT_MS: '500',
      CACHE_ENABLED: 'false',
      QUEUE_ENABLED: 'false',
      GRAPHQL_INTROSPECTION: 'false',
      METRICS_ENABLED: 'false',
    });

    expect(env.SCHEDULE_PORT).toBe(4002);
    expect(env.AUTH_SERVICE_TIMEOUT_MS).toBe(500);
    expect(env.CACHE_ENABLED).toBe(false);
    expect(env.QUEUE_ENABLED).toBe(false);
    expect(env.GRAPHQL_INTROSPECTION).toBe(false);
    expect(env.METRICS_ENABLED).toBe(false);
  });

  it('normalizes SCHEDULE_DATABASE_URL into DATABASE_URL', () => {
    const env = validateEnv({ ...base });

    expect(env.SCHEDULE_DATABASE_URL).toBe(base.SCHEDULE_DATABASE_URL);
    expect(process.env.DATABASE_URL).toBe(base.SCHEDULE_DATABASE_URL);
  });

  it('rejects a missing database URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a malformed auth service URL', () => {
    expect(() => validateEnv({ ...base, AUTH_SERVICE_URL: 'not-a-url' })).toThrow(
      /AUTH_SERVICE_URL/,
    );
  });

  it('rejects an out-of-range retry count', () => {
    expect(() => validateEnv({ ...base, AUTH_SERVICE_MAX_RETRIES: '9' })).toThrow(
      /AUTH_SERVICE_MAX_RETRIES/,
    );
  });

  it('rejects an out-of-range depth limit', () => {
    expect(() => validateEnv({ ...base, GRAPHQL_DEPTH_LIMIT: '99' })).toThrow(
      /GRAPHQL_DEPTH_LIMIT/,
    );
  });
});
