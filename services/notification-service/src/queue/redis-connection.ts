import type { ConnectionOptions } from 'bullmq';

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
    maxRetriesPerRequest: null,
  };
}
