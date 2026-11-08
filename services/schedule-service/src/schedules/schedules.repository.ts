import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { ScheduleWithRelations } from './entities/schedule.entity.js';
import { PrismaService } from '../prisma/prisma.service.js';

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

  create(data: Prisma.ScheduleCreateInput): Promise<ScheduleWithRelations> {
    return this.prisma.schedule.create({ data, include: relations });
  }

  delete(id: string): Promise<ScheduleWithRelations> {
    return this.prisma.schedule.delete({ where: { id }, include: relations });
  }
}
