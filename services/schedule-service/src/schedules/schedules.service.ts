import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth-client/auth-client.types.js';
import { CacheService } from '../cache/cache.service.js';
import { CACHE_NAMESPACES } from '../common/constants.js';
import { DomainError } from '../common/errors/domain.error.js';
import { mapPrismaError } from '../common/errors/prisma-error.js';
import {
  buildPageInfo,
  toSkipTake,
  type PaginationInput,
} from '../common/pagination/pagination.js';
import { CustomersRepository } from '../customers/customers.repository.js';
import { DoctorsRepository } from '../doctors/doctors.repository.js';
import type { Prisma } from '../generated/prisma/client.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { NotificationProducer } from '../queue/notification.producer.js';
import type { ScheduleEmailPayload } from '../queue/notification-events.js';
import type { CreateScheduleInput } from './dto/create-schedule.input.js';
import type { ScheduleFilterInput } from './dto/schedule-filter.input.js';
import type { ScheduleConnection } from './entities/schedule-connection.entity.js';
import {
  toScheduleEntity,
  type ScheduleEntity,
  type ScheduleWithRelations,
} from './entities/schedule.entity.js';
import { ScheduleAuditService } from './schedule-audit.service.js';
import { SchedulesRepository } from './schedules.repository.js';

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    private readonly schedules: SchedulesRepository,
    private readonly customers: CustomersRepository,
    private readonly doctors: DoctorsRepository,
    private readonly cache: CacheService,
    private readonly notifications: NotificationProducer,
    private readonly audit: ScheduleAuditService,
    private readonly metrics: MetricsService,
  ) {}

  async create(input: CreateScheduleInput, actor: AuthenticatedUser): Promise<ScheduleEntity> {
    const [customer, doctor] = await Promise.all([
      this.customers.findById(input.customerId),
      this.doctors.findById(input.doctorId),
    ]);

    if (!customer) {
      throw new DomainError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
    }

    if (!doctor) {
      throw new DomainError('DOCTOR_NOT_FOUND', 'Doctor not found', 404);
    }

    if (await this.schedules.findByDoctorAndTime(input.doctorId, input.scheduledAt)) {
      throw this.conflict(input.doctorId, input.scheduledAt);
    }

    try {
      const schedule = await this.schedules.create({
        objective: input.objective,
        scheduledAt: input.scheduledAt,
        customer: { connect: { id: input.customerId } },
        doctor: { connect: { id: input.doctorId } },
      });

      await this.afterMutation(schedule, 'created', actor);
      this.metrics.recordScheduleOperation('create');
      return toScheduleEntity(schedule);
    } catch (error) {
      mapPrismaError(error, {
        // The unique index wins the race when two requests pass the pre-check.
        P2002: () => this.conflict(input.doctorId, input.scheduledAt),
      });
    }
  }

  async delete(id: string, actor: AuthenticatedUser): Promise<ScheduleEntity> {
    const existing = await this.schedules.findById(id);

    if (!existing) {
      throw new DomainError('SCHEDULE_NOT_FOUND', 'Schedule not found', 404);
    }

    try {
      const schedule = await this.schedules.delete(id);
      await this.afterMutation(schedule, 'deleted', actor);
      this.metrics.recordScheduleOperation('delete');
      return toScheduleEntity(schedule);
    } catch (error) {
      mapPrismaError(error, {
        P2025: () => new DomainError('SCHEDULE_NOT_FOUND', 'Schedule not found', 404),
      });
    }
  }

  async findOne(id: string): Promise<ScheduleEntity> {
    const key = this.cache.staticKey(CACHE_NAMESPACES.schedules, `detail:${id}`);
    const cached = await this.cache.lookup<ScheduleEntity>(key);

    if (cached.hit) {
      if (!cached.value) {
        throw new DomainError('SCHEDULE_NOT_FOUND', 'Schedule not found', 404);
      }

      return cached.value;
    }

    const schedule = await this.schedules.findById(id);

    if (!schedule) {
      await this.cache.store(key, null);
      throw new DomainError('SCHEDULE_NOT_FOUND', 'Schedule not found', 404);
    }

    const entity = toScheduleEntity(schedule);
    await this.cache.store(key, entity);
    return entity;
  }

  async findMany(
    filter: ScheduleFilterInput | undefined,
    pagination: PaginationInput,
  ): Promise<ScheduleConnection> {
    if (filter?.from && filter.to && filter.from > filter.to) {
      throw new DomainError('VALIDATION_ERROR', 'from must be before or equal to to', 400);
    }

    const key = await this.cache.key(
      CACHE_NAMESPACES.schedules,
      `list:${JSON.stringify({
        doctorId: filter?.doctorId ?? null,
        customerId: filter?.customerId ?? null,
        from: filter?.from?.toISOString() ?? null,
        to: filter?.to?.toISOString() ?? null,
        search: filter?.search ?? null,
        page: pagination.page,
        limit: pagination.limit,
      })}`,
    );
    const cached = await this.cache.lookup<ScheduleConnection>(key);

    if (cached.hit && cached.value) {
      return cached.value;
    }

    const where = this.buildWhere(filter);
    const { skip, take } = toSkipTake(pagination);
    const [items, total] = await Promise.all([
      this.schedules.findMany(where, skip, take),
      this.schedules.count(where),
    ]);

    const connection: ScheduleConnection = {
      items: items.map(toScheduleEntity),
      pageInfo: buildPageInfo(pagination.page, pagination.limit, total),
    };

    await this.cache.store(key, connection);
    return connection;
  }

  private buildWhere(filter: ScheduleFilterInput | undefined): Prisma.ScheduleWhereInput {
    const where: Prisma.ScheduleWhereInput = {};

    if (filter?.doctorId) {
      where.doctorId = filter.doctorId;
    }

    if (filter?.customerId) {
      where.customerId = filter.customerId;
    }

    if (filter?.from || filter?.to) {
      where.scheduledAt = {
        ...(filter.from ? { gte: filter.from } : {}),
        ...(filter.to ? { lte: filter.to } : {}),
      };
    }

    if (filter?.search) {
      where.objective = { contains: filter.search, mode: 'insensitive' };
    }

    return where;
  }

  private async afterMutation(
    schedule: ScheduleWithRelations,
    event: 'created' | 'deleted',
    actor: AuthenticatedUser,
  ): Promise<void> {
    const payload: Omit<ScheduleEmailPayload, 'event'> = {
      scheduleId: schedule.id,
      customer: {
        id: schedule.customer.id,
        name: schedule.customer.name,
        email: schedule.customer.email,
      },
      doctor: {
        id: schedule.doctor.id,
        name: schedule.doctor.name,
      },
      objective: schedule.objective,
      scheduledAt: schedule.scheduledAt.toISOString(),
    };

    await Promise.all([
      this.cache.bumpVersion(CACHE_NAMESPACES.schedules),
      this.cache.delete(this.cache.staticKey(CACHE_NAMESPACES.schedules, `detail:${schedule.id}`)),
      event === 'created'
        ? this.notifications.enqueueScheduleCreated(payload)
        : this.notifications.enqueueScheduleDeleted(payload),
      this.audit.record(event === 'created' ? 'SCHEDULE_CREATED' : 'SCHEDULE_DELETED', schedule, actor),
    ]);
  }

  private conflict(doctorId: string, scheduledAt: Date): DomainError {
    this.logger.debug(`Schedule conflict for doctor ${doctorId} at ${scheduledAt.toISOString()}`);

    return new DomainError(
      'SCHEDULE_CONFLICT',
      'The doctor already has a schedule at this time',
      409,
      { doctorId, scheduledAt: scheduledAt.toISOString() },
    );
  }
}
