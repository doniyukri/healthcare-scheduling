import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth-client/auth-client.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ScheduleWithRelations } from './entities/schedule.entity.js';

export type ScheduleAuditAction = 'SCHEDULE_CREATED' | 'SCHEDULE_DELETED';

/**
 * Writes an immutable trail for schedule mutations. Audit failures are logged
 * but never roll back a completed business operation.
 */
@Injectable()
export class ScheduleAuditService {
  private readonly logger = new Logger(ScheduleAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    action: ScheduleAuditAction,
    schedule: ScheduleWithRelations,
    actor: AuthenticatedUser,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entity: 'schedule',
          entityId: schedule.id,
          actorId: actor.id,
          actorEmail: actor.email,
          metadata: {
            objective: schedule.objective,
            customerId: schedule.customerId,
            doctorId: schedule.doctorId,
            scheduledAt: schedule.scheduledAt.toISOString(),
          },
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not write audit log for schedule ${schedule.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}
