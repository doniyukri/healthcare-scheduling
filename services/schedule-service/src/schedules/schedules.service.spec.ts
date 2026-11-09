import { jest } from '@jest/globals';
import type { AuthenticatedUser } from '../auth-client/auth-client.types.js';
import type { CacheService } from '../cache/cache.service.js';
import type { CustomersRepository } from '../customers/customers.repository.js';
import type { DoctorsRepository } from '../doctors/doctors.repository.js';
import type { Customer, Doctor } from '../generated/prisma/client.js';
import type { MetricsService } from '../metrics/metrics.service.js';
import type { NotificationProducer } from '../queue/notification.producer.js';
import type { SchedulesRepository } from './schedules.repository.js';
import { SchedulesService } from './schedules.service.js';
import type { ScheduleWithRelations } from './entities/schedule.entity.js';
import { PaginationInput } from '../common/pagination/pagination.js';

const actor: AuthenticatedUser = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'admin@clinic.local' };

const customer: Customer = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Budi Santoso',
  email: 'budi@example.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const doctor: Doctor = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'dr. Maya Sari',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const schedule: ScheduleWithRelations = {
  id: '33333333-3333-4333-8333-333333333333',
  objective: 'General consultation',
  customerId: customer.id,
  doctorId: doctor.id,
  scheduledAt: new Date('2026-12-01T09:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  customer,
  doctor,
};

function createService() {
  const schedules = {
    findMany: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    findByDoctorAndTime: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  const customers = { findById: jest.fn() };
  const doctors = { findById: jest.fn() };
  const cache = {
    key: jest.fn((namespace: string, suffix: string) => Promise.resolve(`${namespace}:${suffix}`)),
    staticKey: jest.fn((namespace: string, suffix: string) => `${namespace}:${suffix}`),
    lookup: jest.fn(),
    store: jest.fn(),
    delete: jest.fn(),
    bumpVersion: jest.fn(),
  };
  const notifications = {
    enqueueScheduleCreated: jest.fn().mockResolvedValue(undefined),
    enqueueScheduleDeleted: jest.fn().mockResolvedValue(undefined),
  };
  const metrics = { recordScheduleOperation: jest.fn() };

  return {
    service: new SchedulesService(
      schedules as unknown as SchedulesRepository,
      customers as unknown as CustomersRepository,
      doctors as unknown as DoctorsRepository,
      cache as unknown as CacheService,
      notifications as unknown as NotificationProducer,
      metrics as unknown as MetricsService,
    ),
    schedules,
    customers,
    doctors,
    cache,
    notifications,
    metrics,
  };
}

const createInput = {
  objective: 'General consultation',
  customerId: customer.id,
  doctorId: doctor.id,
  scheduledAt: new Date('2026-12-01T09:00:00.000Z'),
};

describe('SchedulesService', () => {
  describe('create', () => {
    it('rejects an unknown customer', async () => {
      const { service, customers, doctors } = createService();
      customers.findById.mockResolvedValue(null);
      doctors.findById.mockResolvedValue(doctor);

      await expect(service.create(createInput, actor)).rejects.toMatchObject({
        code: 'CUSTOMER_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('rejects an unknown doctor', async () => {
      const { service, customers, doctors } = createService();
      customers.findById.mockResolvedValue(customer);
      doctors.findById.mockResolvedValue(null);

      await expect(service.create(createInput, actor)).rejects.toMatchObject({
        code: 'DOCTOR_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('rejects a doctor double booking before writing', async () => {
      const { service, customers, doctors, schedules } = createService();
      customers.findById.mockResolvedValue(customer);
      doctors.findById.mockResolvedValue(doctor);
      schedules.findByDoctorAndTime.mockResolvedValue(schedule);

      await expect(service.create(createInput, actor)).rejects.toMatchObject({
        code: 'SCHEDULE_CONFLICT',
        statusCode: 409,
        details: { doctorId: doctor.id, scheduledAt: '2026-12-01T09:00:00.000Z' },
      });
      expect(schedules.create).not.toHaveBeenCalled();
    });

    it('creates the schedule and publishes side effects', async () => {
      const { service, customers, doctors, schedules, cache, notifications, metrics } =
        createService();
      customers.findById.mockResolvedValue(customer);
      doctors.findById.mockResolvedValue(doctor);
      schedules.findByDoctorAndTime.mockResolvedValue(null);
      schedules.create.mockResolvedValue(schedule);

      await expect(service.create(createInput, actor)).resolves.toMatchObject({
        id: schedule.id,
        customer: { name: customer.name },
        doctor: { name: doctor.name },
      });

      expect(schedules.create).toHaveBeenCalledWith({
        objective: createInput.objective,
        scheduledAt: createInput.scheduledAt,
        customer: { connect: { id: customer.id } },
        doctor: { connect: { id: doctor.id } },
      }, actor);
      expect(notifications.enqueueScheduleCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleId: schedule.id,
          customer: expect.objectContaining({ email: customer.email }),
          scheduledAt: '2026-12-01T09:00:00.000Z',
        }),
      );
      expect(metrics.recordScheduleOperation).toHaveBeenCalledWith('create');
      expect(cache.bumpVersion).toHaveBeenCalledWith('schedules');
    });

    it('maps a unique race to SCHEDULE_CONFLICT', async () => {
      const { service, customers, doctors, schedules } = createService();
      customers.findById.mockResolvedValue(customer);
      doctors.findById.mockResolvedValue(doctor);
      schedules.findByDoctorAndTime.mockResolvedValue(null);
      schedules.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

      await expect(service.create(createInput, actor)).rejects.toMatchObject({
        code: 'SCHEDULE_CONFLICT',
      });
    });
  });

  describe('delete', () => {
    it('rejects an unknown schedule', async () => {
      const { service, schedules } = createService();
      schedules.findById.mockResolvedValue(null);

      await expect(service.delete(schedule.id, actor)).rejects.toMatchObject({
        code: 'SCHEDULE_NOT_FOUND',
      });
    });

    it('deletes the schedule and publishes the cancellation', async () => {
      const { service, schedules, notifications, metrics } = createService();
      schedules.findById.mockResolvedValue(schedule);
      schedules.delete.mockResolvedValue(schedule);

      await expect(service.delete(schedule.id, actor)).resolves.toMatchObject({
        id: schedule.id,
      });

      expect(notifications.enqueueScheduleDeleted).toHaveBeenCalledWith(
        expect.objectContaining({ scheduleId: schedule.id }),
      );
      expect(metrics.recordScheduleOperation).toHaveBeenCalledWith('delete');
    });

    it('maps a concurrent deletion to SCHEDULE_NOT_FOUND', async () => {
      const { service, schedules } = createService();
      schedules.findById.mockResolvedValue(schedule);
      schedules.delete.mockRejectedValue(Object.assign(new Error('missing'), { code: 'P2025' }));

      await expect(service.delete(schedule.id, actor)).rejects.toMatchObject({
        code: 'SCHEDULE_NOT_FOUND',
      });
    });
  });

  describe('findOne', () => {
    it('returns a cached schedule', async () => {
      const { service, schedules, cache } = createService();
      cache.lookup.mockResolvedValue({ hit: true, value: schedule });

      await expect(service.findOne(schedule.id)).resolves.toBe(schedule);
      expect(schedules.findById).not.toHaveBeenCalled();
    });

    it('throws for a cached miss', async () => {
      const { service, cache } = createService();
      cache.lookup.mockResolvedValue({ hit: true, value: null });

      await expect(service.findOne(schedule.id)).rejects.toMatchObject({
        code: 'SCHEDULE_NOT_FOUND',
      });
    });

    it('caches a missing schedule', async () => {
      const { service, schedules, cache } = createService();
      cache.lookup.mockResolvedValue({ hit: false, value: null });
      schedules.findById.mockResolvedValue(null);

      await expect(service.findOne(schedule.id)).rejects.toMatchObject({
        code: 'SCHEDULE_NOT_FOUND',
      });
      expect(cache.store).toHaveBeenCalledWith(expect.any(String), null);
    });

    it('loads and caches a schedule on a miss', async () => {
      const { service, schedules, cache } = createService();
      cache.lookup.mockResolvedValue({ hit: false, value: null });
      schedules.findById.mockResolvedValue(schedule);

      await expect(service.findOne(schedule.id)).resolves.toMatchObject({ id: schedule.id });
      expect(cache.store).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ id: schedule.id }),
      );
    });
  });

  describe('findMany', () => {
    it('rejects an inverted date range', async () => {
      const { service } = createService();

      await expect(
        service.findMany(
          { from: new Date('2026-12-02T00:00:00.000Z'), to: new Date('2026-12-01T00:00:00.000Z') },
          new PaginationInput(),
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('returns a cached page', async () => {
      const { service, schedules, cache } = createService();
      const cached = { items: [], pageInfo: { total: 0 } };
      cache.lookup.mockResolvedValue({ hit: true, value: cached });

      await expect(service.findMany(undefined, new PaginationInput())).resolves.toBe(cached);
      expect(schedules.findMany).not.toHaveBeenCalled();
    });

    it('builds filters and caches the page', async () => {
      const { service, schedules, cache } = createService();
      cache.lookup.mockResolvedValue({ hit: false, value: null });
      schedules.findMany.mockResolvedValue([schedule]);
      schedules.count.mockResolvedValue(1);

      const page = await service.findMany(
        {
          doctorId: doctor.id,
          customerId: customer.id,
          from: new Date('2026-12-01T00:00:00.000Z'),
          to: new Date('2026-12-02T00:00:00.000Z'),
          search: 'consult',
        },
        new PaginationInput(),
      );

      expect(schedules.findMany).toHaveBeenCalledWith(
        {
          doctorId: doctor.id,
          customerId: customer.id,
          scheduledAt: {
            gte: new Date('2026-12-01T00:00:00.000Z'),
            lte: new Date('2026-12-02T00:00:00.000Z'),
          },
          objective: { contains: 'consult', mode: 'insensitive' },
        },
        0,
        10,
      );
      expect(page.pageInfo.total).toBe(1);
      expect(cache.store).toHaveBeenCalledWith(expect.any(String), page);
    });
  });
});
