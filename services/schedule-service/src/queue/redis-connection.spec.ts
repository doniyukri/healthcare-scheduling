import { toRedisConnectionOptions } from './redis-connection.js';

describe('toRedisConnectionOptions', () => {
  it('parses host and port', () => {
    expect(toRedisConnectionOptions('redis://redis-queue:6380')).toMatchObject({
      host: 'redis-queue',
      port: 6380,
      maxRetriesPerRequest: null,
    });
  });

  it('defaults the port to 6379', () => {
    expect(toRedisConnectionOptions('redis://localhost').port).toBe(6379);
  });

  it('decodes credentials and database index', () => {
    expect(toRedisConnectionOptions('redis://user:p%40ss@cache:6379/2')).toMatchObject({
      username: 'user',
      password: 'p@ss',
      db: 2,
    });
  });

  it('enables TLS for rediss URLs', () => {
    expect(toRedisConnectionOptions('rediss://cache:6380')).toMatchObject({
      tls: {},
      port: 6380,
    });
  });
});
