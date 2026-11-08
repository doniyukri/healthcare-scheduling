import { validateEnv } from './env.validation.js';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/auth_db',
  JWT_SECRET: 'a'.repeat(32),
};

describe('validateEnv', () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it('applies defaults for optional values', () => {
    const env = validateEnv({ ...base });

    expect(env.AUTH_PORT).toBe(3001);
    expect(env.BCRYPT_ROUNDS).toBe(12);
    expect(env.JWT_ISSUER).toBe('healthcare-auth');
    expect(env.JWT_AUDIENCE).toBe('healthcare-api');
    expect(env.NODE_ENV).toBe('development');
  });

  it('coerces numeric strings', () => {
    const env = validateEnv({ ...base, AUTH_PORT: '4001', BCRYPT_ROUNDS: '10' });

    expect(env.AUTH_PORT).toBe(4001);
    expect(env.BCRYPT_ROUNDS).toBe(10);
  });

  it('rejects a missing JWT secret', () => {
    expect(() => validateEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(/JWT_SECRET/);
  });

  it('rejects a short JWT secret', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'too-short' })).toThrow(
      /at least 32 characters/,
    );
  });

  it('rejects a missing database URL', () => {
    expect(() => validateEnv({ JWT_SECRET: base.JWT_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('accepts AUTH_DATABASE_URL and exposes it as DATABASE_URL', () => {
    const env = validateEnv({
      AUTH_DATABASE_URL: 'postgresql://user:pass@localhost:5432/auth_db',
      JWT_SECRET: base.JWT_SECRET,
    });

    expect(env.AUTH_DATABASE_URL).toBeDefined();
    expect(process.env.DATABASE_URL).toBe(env.AUTH_DATABASE_URL);
  });

  it('rejects an invalid bcrypt cost', () => {
    expect(() => validateEnv({ ...base, BCRYPT_ROUNDS: '2' })).toThrow(/BCRYPT_ROUNDS/);
  });
});
