import { jest } from '@jest/globals';
import type { Response } from 'express';
import type { CacheService } from '../cache/cache.service.js';
import type { NotificationProducer } from '../queue/notification.producer.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

function createResponse() {
  const status = jest.fn();
  const response = { status } as unknown as Response;
  status.mockReturnValue(response);
  return { response, status };
}

function createController(options: {
  databaseUp?: boolean;
  cacheUp?: boolean;
  queueUp?: boolean;
} = {}) {
  const prisma = {
    $queryRaw: options.databaseUp === false
      ? jest.fn().mockRejectedValue(new Error('connection refused'))
      : jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  } as unknown as PrismaService;
  const cache = {
    isHealthy: jest.fn().mockResolvedValue(options.cacheUp !== false),
  } as unknown as CacheService;
  const notifications = {
    isHealthy: jest.fn().mockResolvedValue(options.queueUp !== false),
  } as unknown as NotificationProducer;

  return new HealthController(prisma, cache, notifications);
}

describe('HealthController', () => {
  it('reports liveness without touching dependencies', () => {
    const controller = createController();

    expect(controller.live()).toMatchObject({ status: 'ok', service: 'schedule-service' });
  });

  it('reports readiness when every dependency is up', async () => {
    const controller = createController();
    const { response, status } = createResponse();

    const body = await controller.ready(response);

    expect(body).toMatchObject({
      status: 'ok',
      checks: {
        database: { status: 'up' },
        cache: { status: 'up' },
        queue: { status: 'up' },
      },
    });
    expect(status).toHaveBeenCalledWith(200);
  });

  it('returns 503 when the database is down', async () => {
    const controller = createController({ databaseUp: false });
    const { response, status } = createResponse();

    const body = await controller.ready(response);

    expect(body).toMatchObject({ status: 'error', checks: { database: { status: 'down' } } });
    expect(status).toHaveBeenCalledWith(503);
  });

  it('returns 503 when the cache is down', async () => {
    const controller = createController({ cacheUp: false });
    const { response, status } = createResponse();

    await controller.ready(response);

    expect(status).toHaveBeenCalledWith(503);
  });

  it('returns 503 when the queue is down', async () => {
    const controller = createController({ queueUp: false });
    const { response, status } = createResponse();

    await controller.ready(response);

    expect(status).toHaveBeenCalledWith(503);
  });

  it('exposes the readiness report on the summary route', async () => {
    const controller = createController();
    const { response, status } = createResponse();

    await expect(controller.summary(response)).resolves.toMatchObject({ status: 'ok' });
    expect(status).toHaveBeenCalledWith(200);
  });
});
