import { Injectable } from '@nestjs/common';
import { CACHE_NAMESPACES } from '../common/constants.js';
import { DomainError } from '../common/errors/domain.error.js';
import { mapPrismaError } from '../common/errors/prisma-error.js';
import {
  buildPageInfo,
  toSkipTake,
  type PaginationInput,
} from '../common/pagination/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import { CacheService } from '../cache/cache.service.js';
import { DoctorsRepository } from './doctors.repository.js';
import type { CreateDoctorInput } from './dto/create-doctor.input.js';
import type { DoctorFilterInput } from './dto/doctor-filter.input.js';
import type { UpdateDoctorInput } from './dto/update-doctor.input.js';
import { toDoctorEntity, type DoctorEntity } from './entities/doctor.entity.js';
import type { DoctorConnection } from './entities/doctor-connection.entity.js';

@Injectable()
export class DoctorsService {
  constructor(
    private readonly doctors: DoctorsRepository,
    private readonly cache: CacheService,
  ) {}

  async create(input: CreateDoctorInput): Promise<DoctorEntity> {
    const doctor = await this.doctors.create({ name: input.name });
    await this.cache.bumpVersion(CACHE_NAMESPACES.doctors);
    return toDoctorEntity(doctor);
  }

  async update(id: string, input: UpdateDoctorInput): Promise<DoctorEntity> {
    if (input.name === undefined) {
      throw new DomainError('VALIDATION_ERROR', 'At least one field must be provided', 400);
    }

    try {
      const doctor = await this.doctors.update(id, { name: input.name });
      await Promise.all([
        this.cache.bumpVersion(CACHE_NAMESPACES.doctors),
        this.cache.delete(this.cache.staticKey(CACHE_NAMESPACES.doctors, `detail:${id}`)),
      ]);
      return toDoctorEntity(doctor);
    } catch (error) {
      mapPrismaError(error, {
        P2025: () => new DomainError('DOCTOR_NOT_FOUND', 'Doctor not found', 404),
      });
    }
  }

  async delete(id: string): Promise<DoctorEntity> {
    const existing = await this.doctors.findById(id);

    if (!existing) {
      throw new DomainError('DOCTOR_NOT_FOUND', 'Doctor not found', 404);
    }

    if ((await this.doctors.countSchedules(id)) > 0) {
      throw new DomainError(
        'DOCTOR_HAS_SCHEDULES',
        'Doctor has schedules and cannot be deleted',
        409,
      );
    }

    try {
      const doctor = await this.doctors.delete(id);
      await Promise.all([
        this.cache.bumpVersion(CACHE_NAMESPACES.doctors),
        this.cache.delete(this.cache.staticKey(CACHE_NAMESPACES.doctors, `detail:${id}`)),
      ]);
      return toDoctorEntity(doctor);
    } catch (error) {
      mapPrismaError(error, {
        P2025: () => new DomainError('DOCTOR_NOT_FOUND', 'Doctor not found', 404),
        P2003: () =>
          new DomainError('DOCTOR_HAS_SCHEDULES', 'Doctor has schedules and cannot be deleted', 409),
      });
    }
  }

  async findOne(id: string): Promise<DoctorEntity> {
    const key = this.cache.staticKey(CACHE_NAMESPACES.doctors, `detail:${id}`);
    const cached = await this.cache.lookup<DoctorEntity>(key);

    if (cached.hit) {
      if (!cached.value) {
        throw new DomainError('DOCTOR_NOT_FOUND', 'Doctor not found', 404);
      }

      return cached.value;
    }

    const doctor = await this.doctors.findById(id);

    if (!doctor) {
      await this.cache.store(key, null);
      throw new DomainError('DOCTOR_NOT_FOUND', 'Doctor not found', 404);
    }

    const entity = toDoctorEntity(doctor);
    await this.cache.store(key, entity);
    return entity;
  }

  async findMany(
    filter: DoctorFilterInput | undefined,
    pagination: PaginationInput,
  ): Promise<DoctorConnection> {
    const key = await this.cache.key(
      CACHE_NAMESPACES.doctors,
      `list:${JSON.stringify({
        search: filter?.search ?? null,
        page: pagination.page,
        limit: pagination.limit,
      })}`,
    );
    const cached = await this.cache.lookup<DoctorConnection>(key);

    if (cached.hit && cached.value) {
      return cached.value;
    }

    const where: Prisma.DoctorWhereInput = filter?.search
      ? { name: { contains: filter.search, mode: 'insensitive' } }
      : {};
    const { skip, take } = toSkipTake(pagination);
    const [items, total] = await Promise.all([
      this.doctors.findMany(where, skip, take),
      this.doctors.count(where),
    ]);

    const connection: DoctorConnection = {
      items: items.map(toDoctorEntity),
      pageInfo: buildPageInfo(pagination.page, pagination.limit, total),
    };

    await this.cache.store(key, connection);
    return connection;
  }
}
