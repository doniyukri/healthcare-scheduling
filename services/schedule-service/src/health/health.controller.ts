import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CacheService } from '../cache/cache.service.js';
import { NotificationProducer } from '../queue/notification.producer.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface DependencyCheck {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly notifications: NotificationProducer,
  ) {}

  /** Liveness: the process is running. No dependencies are checked. */
  @Get('live')
  live(): Record<string, unknown> {
    return {
      status: 'ok',
      service: 'schedule-service',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  /** Readiness: database, cache and queue are reachable. */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<Record<string, unknown>> {
    const [database, cache, queue] = await Promise.all([
      this.check('database', async () => {
        await this.prisma.$queryRaw`SELECT 1`;
      }),
      this.check('cache', async () => {
        if (!(await this.cache.isHealthy())) {
          throw new Error('Redis ping failed');
        }
      }),
      this.check('queue', async () => {
        if (!(await this.notifications.isHealthy())) {
          throw new Error('Queue Redis ping failed');
        }
      }),
    ]);

    const checks = { database, cache, queue };
    const healthy = Object.values(checks).every((check) => check.status === 'up');
    res.status(healthy ? 200 : 503);

    return {
      status: healthy ? 'ok' : 'error',
      service: 'schedule-service',
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
