import { jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import type { MailService } from '../mail/mail.service.js';
import type { ScheduleEmailPayload } from '../mail/mail.types.js';
import type { MetricsService } from '../metrics/metrics.service.js';
import { NotificationConsumer } from './notification.consumer.js';

describe('NotificationConsumer', () => {
  let consumer: NotificationConsumer;
  let sendScheduleNotificationMock: jest.Mock;
  let recordJobProcessedMock: jest.Mock;
  let startJobTimerMock: jest.Mock;
  let stopTimerMock: jest.Mock;

  const mockPayload: ScheduleEmailPayload = {
    event: 'schedule.created',
    scheduleId: 'sched-1',
    customer: { id: 'c1', name: 'Bob', email: 'bob@example.com' },
    doctor: { id: 'd1', name: 'Dr. Strange' },
    objective: 'Consultation',
    scheduledAt: '2026-12-01T10:00:00Z',
  };

  beforeEach(() => {
    sendScheduleNotificationMock = jest.fn().mockResolvedValue(undefined as never);
    recordJobProcessedMock = jest.fn();
    stopTimerMock = jest.fn();
    startJobTimerMock = jest.fn().mockReturnValue(stopTimerMock);

    const mockConfig = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          NOTIFICATION_QUEUE_NAME: 'notifications',
          REDIS_QUEUE_URL: 'redis://localhost:6379',
          WORKER_CONCURRENCY: 1,
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const mockMailService = {
      sendScheduleNotification: sendScheduleNotificationMock,
    } as unknown as MailService;

    const mockMetricsService = {
      recordJobProcessed: recordJobProcessedMock,
      startJobTimer: startJobTimerMock,
    } as unknown as MetricsService;

    consumer = new NotificationConsumer(mockConfig, mockMailService, mockMetricsService);
  });

  it('processes schedule.created job successfully', async () => {
    const job = {
      name: 'schedule.created',
      data: mockPayload,
    } as unknown as Job<ScheduleEmailPayload>;

    await consumer.processJob(job);

    expect(startJobTimerMock).toHaveBeenCalledWith('schedule.created');
    expect(sendScheduleNotificationMock).toHaveBeenCalledWith(mockPayload);
    expect(recordJobProcessedMock).toHaveBeenCalledWith('schedule.created', 'success');
    expect(stopTimerMock).toHaveBeenCalled();
  });

  it('processes schedule.deleted job successfully', async () => {
    const job = {
      name: 'schedule.deleted',
      data: { ...mockPayload, event: 'schedule.deleted' },
    } as unknown as Job<ScheduleEmailPayload>;

    await consumer.processJob(job);

    expect(sendScheduleNotificationMock).toHaveBeenCalled();
    expect(recordJobProcessedMock).toHaveBeenCalledWith('schedule.deleted', 'success');
    expect(stopTimerMock).toHaveBeenCalled();
  });

  it('records failure and throws when mailService fails', async () => {
    sendScheduleNotificationMock.mockRejectedValueOnce(new Error('SMTP failure'));

    const job = {
      name: 'schedule.created',
      data: mockPayload,
    } as unknown as Job<ScheduleEmailPayload>;

    await expect(consumer.processJob(job)).rejects.toThrow('SMTP failure');
    expect(recordJobProcessedMock).toHaveBeenCalledWith('schedule.created', 'failure');
    expect(stopTimerMock).toHaveBeenCalled();
  });

  it('ignores unknown job names safely', async () => {
    const job = {
      name: 'unsupported.event',
      data: mockPayload,
    } as unknown as Job<ScheduleEmailPayload>;

    await consumer.processJob(job);
    expect(sendScheduleNotificationMock).not.toHaveBeenCalled();
    expect(stopTimerMock).toHaveBeenCalled();
  });

  it('reports healthy when worker is initialized and running', async () => {
    (consumer as unknown as { worker: unknown; isWorkerRunning: boolean }).worker = {
      isRunning: jest.fn().mockReturnValue(true),
      close: jest.fn().mockResolvedValue(undefined as never),
    };
    (consumer as unknown as { isWorkerRunning: boolean }).isWorkerRunning = true;

    await expect(consumer.isHealthy()).resolves.toBe(true);

    await consumer.onModuleDestroy();
    await expect(consumer.isHealthy()).resolves.toBe(false);
  });
});
