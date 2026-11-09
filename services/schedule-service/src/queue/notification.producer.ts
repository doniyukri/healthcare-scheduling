import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { NOTIFICATION_JOBS, type NotificationJobName } from '../common/constants.js';
import type { ScheduleEmailPayload } from './notification-events.js';
import { toRedisConnectionOptions } from './redis-connection.js';

/**
 * Produces notification jobs. Enqueueing is best-effort and never fails a
 * schedule mutation: a queue outage degrades notifications, not scheduling.
 */
@Injectable()
export class NotificationProducer implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationProducer.name);
  private readonly queue: Queue<ScheduleEmailPayload> | null;

  constructor(config: ConfigService) {
    if (!config.getOrThrow<boolean>('QUEUE_ENABLED')) {
      this.queue = null;
      this.logger.log('Notification queue disabled by configuration');
      return;
    }

    this.queue = new Queue<ScheduleEmailPayload>(
      config.getOrThrow<string>('NOTIFICATION_QUEUE_NAME'),
      {
        connection: toRedisConnectionOptions(config.getOrThrow<string>('REDIS_QUEUE_URL')),
      },
    );
  }

  enqueueScheduleCreated(payload: Omit<ScheduleEmailPayload, 'event'>): Promise<void> {
    return this.enqueue(NOTIFICATION_JOBS.scheduleCreated, payload);
  }

  enqueueScheduleDeleted(payload: Omit<ScheduleEmailPayload, 'event'>): Promise<void> {
    return this.enqueue(NOTIFICATION_JOBS.scheduleDeleted, payload);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  async isHealthy(): Promise<boolean> {
    if (!this.queue) {
      return true;
    }

    try {
      // Round-trips through the queue's Redis connection; throws when the
      // queue backend is unreachable.
      await this.queue.getJobCounts('waiting');
      return true;
    } catch {
      return false;
    }
  }

  private async enqueue(
    event: NotificationJobName,
    payload: Omit<ScheduleEmailPayload, 'event'>,
  ): Promise<void> {
    if (!this.queue) {
      return;
    }

    try {
      await this.queue.add(
        event,
        { event, ...payload },
        {
          jobId: `${event}-${payload.scheduleId}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      );
    } catch (error) {
      this.logger.warn(
        `Could not enqueue ${event} for schedule ${payload.scheduleId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
