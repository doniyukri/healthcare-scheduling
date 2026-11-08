import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { collectDefaultMetrics, Counter, Registry } from 'prom-client';

/**
 * Prometheus registry for the Schedule Service. Metrics are deliberately
 * low-cardinality: labels describe operations and cache namespaces, never
 * user input or identifiers.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly cacheHits = new Counter({
    name: 'schedule_cache_hits_total',
    help: 'Number of cache lookups served from Redis.',
    labelNames: ['namespace'],
    registers: [this.registry],
  });

  readonly cacheMisses = new Counter({
    name: 'schedule_cache_misses_total',
    help: 'Number of cache lookups that required a database read.',
    labelNames: ['namespace'],
    registers: [this.registry],
  });

  readonly scheduleOperations = new Counter({
    name: 'schedule_operations_total',
    help: 'Number of schedule mutations by operation.',
    labelNames: ['operation'],
    registers: [this.registry],
  });

  constructor(config: ConfigService) {
    if (config.getOrThrow<boolean>('METRICS_ENABLED')) {
      collectDefaultMetrics({ register: this.registry, prefix: 'schedule_' });
    }
  }

  recordCacheLookup(key: string, hit: boolean): void {
    const namespace = key.split(':')[2] ?? 'unknown';
    const counter = hit ? this.cacheHits : this.cacheMisses;
    counter.inc({ namespace });
  }

  recordScheduleOperation(operation: 'create' | 'delete'): void {
    this.scheduleOperations.inc({ operation });
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
