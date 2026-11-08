import { jest } from '@jest/globals';
import type { Response } from 'express';
import type { MailService } from '../mail/mail.service.js';
import type { NotificationConsumer } from '../queue/notification.consumer.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  let mailService: { isHealthy: jest.Mock };
  let consumer: { isHealthy: jest.Mock };
  let res: { status: jest.Mock };

  beforeEach(() => {
    mailService = { isHealthy: jest.fn().mockResolvedValue(true as never) };
    consumer = { isHealthy: jest.fn().mockResolvedValue(true as never) };
    res = { status: jest.fn() };

    controller = new HealthController(
      mailService as unknown as MailService,
      consumer as unknown as NotificationConsumer,
    );
  });

  it('returns ok for liveness probe', () => {
    const live = controller.live();
    expect(live.status).toBe('ok');
    expect(live.service).toBe('notification-service');
  });

  it('returns 200 when all dependencies are healthy', async () => {
    const ready = await controller.ready(res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(ready.status).toBe('ok');
  });

  it('returns 503 when SMTP is unhealthy', async () => {
    mailService.isHealthy.mockResolvedValueOnce(false as never);
    const ready = await controller.ready(res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(ready.status).toBe('error');
  });

  it('returns 503 when queue worker is unhealthy', async () => {
    consumer.isHealthy.mockResolvedValueOnce(false as never);
    const ready = await controller.ready(res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(ready.status).toBe('error');
  });
});
