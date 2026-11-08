import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly notificationsProcessed = new Counter({
    name: 'notification_jobs_processed_total',
    help: 'Total number of notification jobs processed by outcome and event.',
    labelNames: ['event', 'status'],
    registers: [this.registry],
  });

  readonly jobProcessingDuration = new Histogram({
    name: 'notification_job_duration_seconds',
    help: 'Duration of notification job processing in seconds.',
    labelNames: ['event'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  readonly emailsSent = new Counter({
    name: 'notification_emails_sent_total',
    help: 'Total number of emails successfully sent through SMTP.',
    labelNames: ['event'],
    registers: [this.registry],
  });

  constructor(config: ConfigService) {
    if (config.getOrThrow<boolean>('METRICS_ENABLED')) {
      collectDefaultMetrics({ register: this.registry, prefix: 'notification_' });
    }
  }

  recordJobProcessed(event: string, status: 'success' | 'failure'): void {
    this.notificationsProcessed.inc({ event, status });
  }

  recordEmailSent(event: string): void {
    this.emailsSent.inc({ event });
  }

  startJobTimer(event: string): () => void {
    return this.jobProcessingDuration.startTimer({ event });
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
