import type { ConnectionOptions } from 'bullmq';

/**
 * BullMQ takes ioredis connection options, not a URL string. Parse the
 * configured URL once so every deployment style (host, port, auth, TLS, db)
 * works without a second set of environment variables.
 */
export function toRedisConnectionOptions(url: string): ConnectionOptions {
  const parsed = new URL(url);
  const dbFromPath = parsed.pathname.replace('/', '');

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(dbFromPath ? { db: Number(dbFromPath) } : {}),
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    // BullMQ requires this to be null so commands survive transient reconnects.
    maxRetriesPerRequest: null,
  };
}
