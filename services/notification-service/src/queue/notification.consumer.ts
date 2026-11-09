import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Job, Worker } from 'bullmq';
import { MailService } from '../mail/mail.service.js';
import type { ScheduleEmailPayload } from '../mail/mail.types.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { toRedisConnectionOptions } from './redis-connection.js';

@Injectable()
export class NotificationConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationConsumer.name);
  private worker!: Worker<ScheduleEmailPayload>;
  private isWorkerRunning = false;

  constructor(
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    const queueName = this.config.getOrThrow<string>('NOTIFICATION_QUEUE_NAME');
    const redisUrl = this.config.getOrThrow<string>('REDIS_QUEUE_URL');
    const concurrency = this.config.getOrThrow<number>('WORKER_CONCURRENCY');

    this.worker = new Worker<ScheduleEmailPayload>(
      queueName,
      async (job: Job<ScheduleEmailPayload>) => this.processJob(job),
      {
        connection: toRedisConnectionOptions(redisUrl),
        concurrency,
      },
    );

    this.worker.on('ready', () => {
      this.isWorkerRunning = true;
      this.logger.log(`BullMQ worker connected to queue "${queueName}"`);
    });

    this.worker.on('completed', (job: Job<ScheduleEmailPayload>) => {
      this.logger.log(
        `Job ${job.id} (${job.name}) completed successfully for schedule ${job.data.scheduleId}`,
      );
    });

    this.worker.on('failed', (job: Job<ScheduleEmailPayload> | undefined, error: Error) => {
      this.logger.error(
        `Job ${job?.id ?? 'unknown'} (${job?.name ?? 'unknown'}) failed on attempt ${
          job?.attemptsMade ?? 'unknown'
        }: ${error.message}`,
        error.stack,
      );
    });

    this.worker.on('error', (error: Error) => {
      this.logger.error(`BullMQ worker error: ${error.message}`, error.stack);
    });
  }

  async processJob(job: Job<ScheduleEmailPayload>): Promise<void> {
    const endTimer = this.metrics.startJobTimer(job.name);
    try {
      if (job.name === 'schedule.created' || job.name === 'schedule.deleted') {
        await this.mailService.sendScheduleNotification(job.data);
        this.metrics.recordJobProcessed(job.name, 'success');
      } else {
        this.logger.warn(`Unknown job name received: ${job.name}`);
      }
    } catch (error) {
      this.metrics.recordJobProcessed(job.name, 'failure');
      throw error;
    } finally {
      endTimer();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.isWorkerRunning = false;
    if (this.worker) {
      await this.worker.close();
      this.logger.log('BullMQ worker closed');
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.worker) {
      return false;
    }
    try {
      return this.isWorkerRunning && this.worker.isRunning();
    } catch {
      return false;
    }
  }
}
