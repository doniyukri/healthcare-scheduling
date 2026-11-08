import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';

interface DependencyCheck {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is running. No dependencies are checked. */
  @Get('live')
  live(): Record<string, unknown> {
    return {
      status: 'ok',
      service: 'auth-service',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  /** Readiness: the service can serve traffic (database reachable). */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<Record<string, unknown>> {
    const database = await this.checkDatabase();
    const healthy = database.status === 'up';

    res.status(healthy ? 200 : 503);

    return {
      status: healthy ? 'ok' : 'error',
      service: 'auth-service',
      checks: { database },
    };
  }

  @Get()
  summary(@Res({ passthrough: true }) res: Response): Promise<Record<string, unknown>> {
    return this.ready(res);
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    const startedAt = performance.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Math.round(performance.now() - startedAt) };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : 'unknown error',
      };
    }
  }
}
