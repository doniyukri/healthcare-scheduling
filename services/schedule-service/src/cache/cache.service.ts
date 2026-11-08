import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { MetricsService } from '../metrics/metrics.service.js';

const NULL_SENTINEL = '__healthcare_cache_null__';
const KEY_PREFIX = 'schedule:v1';

export interface CacheLookup<T> {
  hit: boolean;
  value: T | null;
}

/**
 * Redis cache with versioned invalidation and graceful degradation.
 *
 * Every failure is swallowed and treated as a cache miss: Redis is an
 * optimization, never a dependency of the request path. Namespace versions let
 * a mutation invalidate a whole list without scanning keys, which stays O(1)
 * and race-safe compared to `KEYS`/`SCAN` deletion.
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis | null;
  private readonly ttlMs: number;
  private readonly jitterPercent: number;
  private readonly negativeTtlMs: number;
  private available = false;
  private errorLogged = false;

  constructor(config: ConfigService, private readonly metrics: MetricsService) {
    const enabled = config.getOrThrow<boolean>('CACHE_ENABLED');
    this.ttlMs = config.getOrThrow<number>('CACHE_TTL_MS');
    this.jitterPercent = config.getOrThrow<number>('CACHE_TTL_JITTER_PERCENT');
    this.negativeTtlMs = config.getOrThrow<number>('CACHE_NEGATIVE_TTL_MS');

    this.client = enabled
      ? new Redis(config.getOrThrow<string>('REDIS_CACHE_URL'), {
          lazyConnect: true,
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          retryStrategy: (attempt) => Math.min(attempt * 250, 5000),
        })
      : null;

    if (this.client) {
      this.client.on('ready', () => {
        this.available = true;
        this.errorLogged = false;
        this.logger.log('Redis cache connected');
      });
      this.client.on('error', (error: Error) => {
        this.available = false;
        if (!this.errorLogged) {
          this.errorLogged = true;
          this.logger.warn(`Redis cache unavailable, serving without cache: ${error.message}`);
        }
      });
    } else {
      this.logger.log('Redis cache disabled by configuration');
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      return;
    }

    // Never block startup on Redis: the service must boot during a cache outage.
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.warn(
        `Initial Redis connection failed, continuing without cache: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  async lookup<T>(key: string): Promise<CacheLookup<T>> {
    if (!this.client || !this.available) {
      return { hit: false, value: null };
    }

    try {
      const raw = await this.client.get(key);

      if (raw === null) {
        this.metrics.recordCacheLookup(key, false);
        return { hit: false, value: null };
      }

      const value = raw === NULL_SENTINEL ? null : (JSON.parse(raw) as T);
      this.metrics.recordCacheLookup(key, true);
      return { hit: true, value };
    } catch {
      this.metrics.recordCacheLookup(key, false);
      return { hit: false, value: null };
    }
  }

  async store<T>(key: string, value: T | null, ttlMs = this.ttlMs): Promise<void> {
    if (!this.client || !this.available) {
      return;
    }

    try {
      const ttl = value === null ? this.negativeTtlMs : this.withJitter(ttlMs);
      const payload = value === null ? NULL_SENTINEL : JSON.stringify(value);
      await this.client.set(key, payload, 'PX', ttl);
    } catch {
      // Cache writes are best-effort.
    }
  }

  async delete(...keys: string[]): Promise<void> {
    if (!this.client || !this.available || keys.length === 0) {
      return;
    }

    try {
      await this.client.del(...keys);
    } catch {
      // Cache invalidation failures fall back to TTL expiry.
    }
  }

  /**
   * Builds a key that includes the current namespace version, so bumping the
   * version makes every previously cached list unreachable in one operation.
   */
  async key(namespace: string, suffix: string): Promise<string> {
    const version = await this.version(namespace);
    return `${KEY_PREFIX}:${namespace}:v${version}:${suffix}`;
  }

  /**
   * A key that is not tied to the namespace version, for entries invalidated
   * individually (detail lookups) rather than by a bulk list invalidation.
   */
  staticKey(namespace: string, suffix: string): string {
    return `${KEY_PREFIX}:${namespace}:${suffix}`;
  }

  async bumpVersion(namespace: string): Promise<void> {
    if (!this.client || !this.available) {
      return;
    }

    try {
      const key = `${KEY_PREFIX}:${namespace}:version`;
      const current = await this.client.incr(key);
      if (current === 1) {
        // If the key was freshly initialised by INCR (meaning the namespace was at default v1),
        // increment once more to advance the version to v2 so existing v1 keys are invalidated.
        await this.client.incr(key);
      }
    } catch {
      // The next TTL expiry repairs the cache eventually.
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.client) {
      return true;
    }

    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  private async version(namespace: string): Promise<number> {
    if (!this.client || !this.available) {
      return 1;
    }

    try {
      const raw = await this.client.get(`${KEY_PREFIX}:${namespace}:version`);
      return raw ? Number(raw) || 1 : 1;
    } catch {
      return 1;
    }
  }

  private withJitter(ttlMs: number): number {
    const spread = (this.jitterPercent / 100) * ttlMs;
    const offset = (Math.random() * 2 - 1) * spread;
    return Math.max(1, Math.round(ttlMs + offset));
  }
}
