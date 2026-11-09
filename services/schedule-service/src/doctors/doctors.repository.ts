import { Injectable } from '@nestjs/common';
import type { Doctor, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DoctorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(where: Prisma.DoctorWhereInput, skip: number, take: number): Promise<Doctor[]> {
    return this.prisma.doctor.findMany({
      where,
      skip,
      take,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  count(where: Prisma.DoctorWhereInput): Promise<number> {
    return this.prisma.doctor.count({ where });
  }

  findById(id: string): Promise<Doctor | null> {
    return this.prisma.doctor.findUnique({ where: { id } });
  }

  create(data: Prisma.DoctorCreateInput): Promise<Doctor> {
    return this.prisma.doctor.create({ data });
  }

  update(id: string, data: Prisma.DoctorUpdateInput): Promise<Doctor> {
    return this.prisma.doctor.update({ where: { id }, data });
  }

  delete(id: string): Promise<Doctor> {
    return this.prisma.doctor.delete({ where: { id } });
  }

  countSchedules(doctorId: string): Promise<number> {
    return this.prisma.schedule.count({ where: { doctorId } });
  }
}
