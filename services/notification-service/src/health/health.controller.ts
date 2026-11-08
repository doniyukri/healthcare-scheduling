import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MailService } from '../mail/mail.service.js';
import { NotificationConsumer } from '../queue/notification.consumer.js';

interface DependencyCheck {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly mailService: MailService,
    private readonly consumer: NotificationConsumer,
  ) {}

  @Get('live')
  live(): Record<string, unknown> {
    return {
      status: 'ok',
      service: 'notification-service',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<Record<string, unknown>> {
    const [smtp, queue] = await Promise.all([
      this.check('smtp', async () => {
        if (!(await this.mailService.isHealthy())) {
          throw new Error('SMTP connection verification failed');
        }
      }),
      this.check('queue', async () => {
        if (!(await this.consumer.isHealthy())) {
          throw new Error('Queue worker is not healthy');
        }
      }),
    ]);

    const checks = { smtp, queue };
    const healthy = Object.values(checks).every((check) => check.status === 'up');
    res.status(healthy ? 200 : 503);

    return {
      status: healthy ? 'ok' : 'error',
      service: 'notification-service',
      checks,
    };
  }

  @Get()
  summary(@Res({ passthrough: true }) res: Response): Promise<Record<string, unknown>> {
    return this.ready(res);
  }

  private async check(name: string, probe: () => Promise<void>): Promise<DependencyCheck> {
    const startedAt = performance.now();

    try {
      await probe();
      return { status: 'up', latencyMs: Math.round(performance.now() - startedAt) };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Math.round(performance.now() - startedAt),
        error: `${name}: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }
}
