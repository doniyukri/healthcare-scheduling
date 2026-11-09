import { jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { MetricsService } from '../metrics/metrics.service.js';
import { GraphQLISODateTime } from '@nestjs/graphql';

type Handler = (...args: unknown[]) => void;

/**
 * Minimal in-memory stand-in for ioredis. The service only uses a small,
 * well-defined command surface, so a real Redis is unnecessary for unit tests.
 */
class FakeRedis {
  static instance: FakeRedis | null = null;

  private readonly handlers = new Map<string, Handler[]>();
  readonly data = new Map<string, string>();

  connect = jest.fn(async (): Promise<void> => {
    this.emit('ready');
  });

  quit = jest.fn(async (): Promise<string> => 'OK');

  disconnect = jest.fn((): void => undefined);

  get = jest.fn(async (key: string): Promise<string | null> => this.data.get(key) ?? null);

  set = jest.fn(async (key: string, value: string): Promise<string> => {
    this.data.set(key, value);
    return 'OK';
  });

  del = jest.fn(async (...keys: string[]): Promise<number> => {
    let removed = 0;
    for (const key of keys) {
      if (this.data.delete(key)) {
        removed += 1;
      }
    }
    return removed;
  });

  incr = jest.fn(async (key: string): Promise<number> => {
    const next = Number(this.data.get(key) ?? '0') + 1;
    this.data.set(key, String(next));
    return next;
  });

  ping = jest.fn(async (): Promise<string> => 'PONG');

  constructor(
    readonly url: string,
    readonly options: unknown,
  ) {
    FakeRedis.instance = this;
  }

  on(event: string, handler: Handler): this {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...args);
    }
  }
}

jest.unstable_mockModule('ioredis', () => ({ Redis: FakeRedis }));

const { CacheService } = await import('./cache.service.js');

const configValues = {
  CACHE_ENABLED: true,
  CACHE_TTL_MS: 60_000,
  CACHE_TTL_JITTER_PERCENT: 0,
  CACHE_NEGATIVE_TTL_MS: 5_000,
  REDIS_CACHE_URL: 'redis://cache:6379',
};

function createConfig(overrides: Partial<typeof configValues> = {}): ConfigService {
  const values = { ...configValues, ...overrides };
  return { getOrThrow: (key: keyof typeof values) => values[key] } as unknown as ConfigService;
}

function createMetrics(): MetricsService {
  return { recordCacheLookup: jest.fn() } as unknown as MetricsService;
}

async function createService(
  overrides: Partial<typeof configValues> = {},
): Promise<{ service: InstanceType<typeof CacheService>; metrics: MetricsService; redis: FakeRedis }> {
  const metrics = createMetrics();
  const service = new CacheService(createConfig(overrides), metrics);
  const redis = FakeRedis.instance as FakeRedis;
  await service.onModuleInit();

  return { service, metrics, redis };
}

describe('CacheService', () => {
  afterEach(() => {
    FakeRedis.instance = null;
  });

  it('restores appointment and nested entity dates after a cache round trip', async () => {
    const { service } = await createService();
    const time = new Date('2026-11-09T09:00:00.000Z');
    await service.store('schedule', { items: [{ scheduledAt: time, createdAt: time, updatedAt: time, objective: '2026-11-09T09:00:00.000Z', customer: { createdAt: time, updatedAt: time }, doctor: { createdAt: time, updatedAt: time } }] });
    const result = await service.lookup<{ items: Array<{ scheduledAt: Date; createdAt: Date; updatedAt: Date; objective: string; customer: { createdAt: Date; updatedAt: Date }; doctor: { createdAt: Date; updatedAt: Date } }> }>('schedule');
    const item = result.value!.items[0];
    for (const date of [item.scheduledAt, item.createdAt, item.updatedAt, item.customer.createdAt, item.customer.updatedAt, item.doctor.createdAt, item.doctor.updatedAt]) {
      expect(date).toBeInstanceOf(Date);
      expect(GraphQLISODateTime.serialize(date)).toBe(time.toISOString());
    }
    expect(item.objective).toBe(time.toISOString());
  });

  it('reads, writes and deletes values while tracking metrics', async () => {
    const { service, metrics, redis } = await createService();

    await service.store('key', { id: '1' });

    expect(redis.set).toHaveBeenCalledWith('key', JSON.stringify({ id: '1' }), 'PX', 60_000);
    await expect(service.lookup<{ id: string }>('key')).resolves.toEqual({
      hit: true,
      value: { id: '1' },
    });
    expect(metrics.recordCacheLookup).toHaveBeenCalledWith('key', true);

    await service.delete('key');
    expect(redis.del).toHaveBeenCalledWith('key');
    await expect(service.lookup('key')).resolves.toEqual({ hit: false, value: null });
    expect(metrics.recordCacheLookup).toHaveBeenCalledWith('key', false);
  });

  it('stores negative lookups with the negative TTL', async () => {
    const { service, redis } = await createService();

    await service.store('missing', null);

    expect(redis.set).toHaveBeenCalledWith('missing', '__healthcare_cache_null__', 'PX', 5_000);
    await expect(service.lookup('missing')).resolves.toEqual({ hit: true, value: null });
  });

  it('treats malformed JSON as a miss', async () => {
    const { service, redis, metrics } = await createService();
    redis.data.set('broken', 'not-json');

    await expect(service.lookup('broken')).resolves.toEqual({ hit: false, value: null });
    expect(metrics.recordCacheLookup).toHaveBeenCalledWith('broken', false);
  });

  it('versions list keys and bumps the namespace version', async () => {
    const { service } = await createService();

    await expect(service.key('customers', 'list:1')).resolves.toBe(
      'schedule:v1:customers:v1:list:1',
    );

    await service.bumpVersion('customers');
    await service.bumpVersion('customers');

    await expect(service.key('customers', 'list:1')).resolves.toBe(
      'schedule:v1:customers:v3:list:1',
    );
    expect(service.staticKey('customers', 'detail:1')).toBe('schedule:v1:customers:detail:1');
  });

  it('reports health from the Redis ping', async () => {
    const { service, redis } = await createService();

    await expect(service.isHealthy()).resolves.toBe(true);

    redis.ping.mockResolvedValueOnce('nope');
    await expect(service.isHealthy()).resolves.toBe(false);
  });

  it('reports unhealthy when Redis throws', async () => {
    const { service, redis } = await createService();
    redis.ping.mockRejectedValueOnce(new Error('connection lost'));

    await expect(service.isHealthy()).resolves.toBe(false);
  });

  it('swallows Redis failures and degrades to misses', async () => {
    const { service, redis } = await createService();
    redis.get.mockRejectedValueOnce(new Error('down'));
    redis.set.mockRejectedValueOnce(new Error('down'));
    redis.del.mockRejectedValueOnce(new Error('down'));
    redis.incr.mockRejectedValueOnce(new Error('down'));

    await expect(service.lookup('key')).resolves.toEqual({ hit: false, value: null });
    await expect(service.store('key', 'value')).resolves.toBeUndefined();
    await expect(service.delete('key')).resolves.toBeUndefined();
    await expect(service.bumpVersion('customers')).resolves.toBeUndefined();
    await expect(service.key('customers', 'list:1')).resolves.toBe(
      'schedule:v1:customers:v1:list:1',
    );
  });

  it('does nothing when caching is disabled', async () => {
    const metrics = createMetrics();
    const service = new CacheService(createConfig({ CACHE_ENABLED: false }), metrics);

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(service.lookup('key')).resolves.toEqual({ hit: false, value: null });
    await expect(service.store('key', 'value')).resolves.toBeUndefined();
    await expect(service.delete('key')).resolves.toBeUndefined();
    await expect(service.bumpVersion('customers')).resolves.toBeUndefined();
    await expect(service.isHealthy()).resolves.toBe(true);
    await expect(service.key('customers', 'list:1')).resolves.toBe(
      'schedule:v1:customers:v1:list:1',
    );
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('disconnects when a graceful quit fails', async () => {
    const { service, redis } = await createService();
    redis.quit.mockRejectedValueOnce(new Error('already closed'));

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect(redis.disconnect).toHaveBeenCalled();
  });

  it('continues booting when the initial connection fails', async () => {
    const metrics = createMetrics();
    const service = new CacheService(createConfig(), metrics);
    const redis = FakeRedis.instance as FakeRedis;
    redis.connect.mockRejectedValueOnce(new Error('refused'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(service.lookup('key')).resolves.toEqual({ hit: false, value: null });
  });

  it('marks the cache unavailable after a client error', async () => {
    const { service, redis } = await createService();

    redis.emit('error', new Error('connection reset'));

    await expect(service.lookup('key')).resolves.toEqual({ hit: false, value: null });
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('applies TTL jitter without going below one millisecond', async () => {
    const { service, redis } = await createService({ CACHE_TTL_JITTER_PERCENT: 50 });

    await service.store('key', 'value');

    const ttl = redis.set.mock.calls[0][3] as number;
    expect(ttl).toBeGreaterThanOrEqual(1);
    expect(ttl).toBeGreaterThanOrEqual(30_000);
    expect(ttl).toBeLessThanOrEqual(90_000);
  });
});
