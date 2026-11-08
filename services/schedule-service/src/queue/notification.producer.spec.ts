import { jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';

type AddCall = [string, Record<string, unknown>, Record<string, unknown>];

class FakeQueue {
  static instances: FakeQueue[] = [];

  add = jest.fn(async (..._args: AddCall): Promise<Record<string, unknown>> => ({}));

  close = jest.fn(async (): Promise<void> => undefined);

  getJobCounts = jest.fn(async (..._types: string[]): Promise<Record<string, number>> => ({
    waiting: 0,
  }));

  constructor(
    readonly name: string,
    readonly options: unknown,
  ) {
    FakeQueue.instances.push(this);
  }
}

jest.unstable_mockModule('bullmq', () => ({ Queue: FakeQueue }));

const { NotificationProducer } = await import('./notification.producer.js');

const configValues = {
  QUEUE_ENABLED: true,
  NOTIFICATION_QUEUE_NAME: 'notifications',
  REDIS_QUEUE_URL: 'redis://redis-queue:6379',
};

function createConfig(overrides: Partial<typeof configValues> = {}): ConfigService {
  const values = { ...configValues, ...overrides };
  return { getOrThrow: (key: keyof typeof values) => values[key] } as unknown as ConfigService;
}

const payload = {
  scheduleId: '33333333-3333-4333-8333-333333333333',
  customer: { id: 'customer-1', name: 'Budi', email: 'budi@example.com' },
  doctor: { id: 'doctor-1', name: 'dr. Maya' },
  objective: 'General consultation',
  scheduledAt: '2026-12-01T09:00:00.000Z',
};

describe('NotificationProducer', () => {
  beforeEach(() => {
    FakeQueue.instances = [];
  });

  it('creates the queue from the configured name and URL', () => {
    new NotificationProducer(createConfig());

    expect(FakeQueue.instances).toHaveLength(1);
    expect(FakeQueue.instances[0].name).toBe('notifications');
    expect(FakeQueue.instances[0].options).toMatchObject({
      connection: { host: 'redis-queue', port: 6379, maxRetriesPerRequest: null },
    });
  });

  it('enqueues a schedule.created job with retry and retention options', async () => {
    const producer = new NotificationProducer(createConfig());

    await producer.enqueueScheduleCreated(payload);

    expect(FakeQueue.instances[0].add).toHaveBeenCalledWith(
      'schedule.created',
      { event: 'schedule.created', ...payload },
      {
        jobId: 'schedule.created-33333333-3333-4333-8333-333333333333',
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    );
  });

  it('enqueues a schedule.deleted job', async () => {
    const producer = new NotificationProducer(createConfig());

    await producer.enqueueScheduleDeleted(payload);

    expect(FakeQueue.instances[0].add).toHaveBeenCalledWith(
      'schedule.deleted',
      { event: 'schedule.deleted', ...payload },
      expect.objectContaining({
        jobId: 'schedule.deleted-33333333-3333-4333-8333-333333333333',
      }),
    );
  });

  it('never fails the caller when enqueueing fails', async () => {
    const producer = new NotificationProducer(createConfig());
    FakeQueue.instances[0].add.mockRejectedValueOnce(new Error('redis down'));

    await expect(producer.enqueueScheduleCreated(payload)).resolves.toBeUndefined();
  });

  it('is a no-op when the queue is disabled', async () => {
    const producer = new NotificationProducer(createConfig({ QUEUE_ENABLED: false }));

    await expect(producer.enqueueScheduleCreated(payload)).resolves.toBeUndefined();
    await expect(producer.enqueueScheduleDeleted(payload)).resolves.toBeUndefined();
    await expect(producer.isHealthy()).resolves.toBe(true);
    await expect(producer.onModuleDestroy()).resolves.toBeUndefined();
    expect(FakeQueue.instances).toHaveLength(0);
  });

  it('reports queue health from Redis job counts', async () => {
    const producer = new NotificationProducer(createConfig());

    await expect(producer.isHealthy()).resolves.toBe(true);

    FakeQueue.instances[0].getJobCounts.mockRejectedValueOnce(new Error('down'));
    await expect(producer.isHealthy()).resolves.toBe(false);
  });

  it('closes the queue on shutdown', async () => {
    const producer = new NotificationProducer(createConfig());

    await producer.onModuleDestroy();

    expect(FakeQueue.instances[0].close).toHaveBeenCalled();
  });
});
