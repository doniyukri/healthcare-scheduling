import { jest } from '@jest/globals';
import type { Response } from 'express';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

function createController() {
  const prisma = { $queryRaw: jest.fn() };
  const response = { status: jest.fn() };

  return {
    controller: new HealthController(prisma as unknown as PrismaService),
    prisma,
    response: response as unknown as Response,
    status: response.status,
  };
}

describe('HealthController', () => {
  it('reports liveness without touching dependencies', () => {
    const { controller, prisma } = createController();

    expect(controller.live()).toMatchObject({
      status: 'ok',
      service: 'auth-service',
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('reports readiness when the database responds', async () => {
    const { controller, prisma, response, status } = createController();
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.ready(response);

    expect(status).toHaveBeenCalledWith(200);
    expect(result).toMatchObject({
      status: 'ok',
      checks: { database: { status: 'up' } },
    });
  });

  it('reports 503 when the database is unreachable', async () => {
    const { controller, prisma, response, status } = createController();
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    const result = await controller.ready(response);

    expect(status).toHaveBeenCalledWith(503);
    expect(result).toMatchObject({
      status: 'error',
      checks: { database: { status: 'down' } },
    });
  });

  it('serves the summary from the readiness check', async () => {
    const { controller, prisma, response } = createController();
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(controller.summary(response)).resolves.toMatchObject({
      status: 'ok',
    });
  });
});
