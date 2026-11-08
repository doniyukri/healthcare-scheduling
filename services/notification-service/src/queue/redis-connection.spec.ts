import { toRedisConnectionOptions } from './redis-connection.js';

describe('toRedisConnectionOptions', () => {
  it('parses standard redis url', () => {
    const opts = toRedisConnectionOptions('redis://redis-queue:6379');
    expect(opts.host).toBe('redis-queue');
    expect(opts.port).toBe(6379);
    expect(opts.maxRetriesPerRequest).toBeNull();
  });

  it('parses authentication and database index', () => {
    const opts = toRedisConnectionOptions('redis://user:pass@localhost:6380/2');
    expect(opts.host).toBe('localhost');
    expect(opts.port).toBe(6380);
    expect(opts.username).toBe('user');
    expect(opts.password).toBe('pass');
    expect(opts.db).toBe(2);
  });
});
