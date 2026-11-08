import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { ScheduleWithRelations } from './entities/schedule.entity.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth-client/auth-client.types.js';

const relations = { customer: true, doctor: true } as const;

@Injectable()
export class SchedulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(
    where: Prisma.ScheduleWhereInput,
    skip: number,
    take: number,
  ): Promise<ScheduleWithRelations[]> {
    return this.prisma.schedule.findMany({
      where,
      skip,
      take,
      include: relations,
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    });
  }

  count(where: Prisma.ScheduleWhereInput): Promise<number> {
    return this.prisma.schedule.count({ where });
  }

  findById(id: string): Promise<ScheduleWithRelations | null> {
    return this.prisma.schedule.findUnique({ where: { id }, include: relations });
  }

  findByDoctorAndTime(doctorId: string, scheduledAt: Date): Promise<ScheduleWithRelations | null> {
    return this.prisma.schedule.findUnique({
      where: { schedule_doctor_time_unique: { doctorId, scheduledAt } },
      include: relations,
    });
  }

  create(data: Prisma.ScheduleCreateInput, actor: AuthenticatedUser): Promise<ScheduleWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const schedule = await tx.schedule.create({ data, include: relations });
      await this.audit(tx, 'SCHEDULE_CREATED', schedule, actor);
      return schedule;
    });
  }

  delete(id: string, actor: AuthenticatedUser): Promise<ScheduleWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const schedule = await tx.schedule.delete({ where: { id }, include: relations });
      await this.audit(tx, 'SCHEDULE_DELETED', schedule, actor);
      return schedule;
    });
  }

  private async audit(tx: Prisma.TransactionClient, action: string, schedule: ScheduleWithRelations, actor: AuthenticatedUser): Promise<void> {
    await tx.auditLog.create({ data: {
      action, entity: 'schedule', entityId: schedule.id, actorId: actor.id, actorEmail: actor.email,
      metadata: { objective: schedule.objective, customerId: schedule.customerId, doctorId: schedule.doctorId, scheduledAt: schedule.scheduledAt.toISOString() },
    } });
  }
}
