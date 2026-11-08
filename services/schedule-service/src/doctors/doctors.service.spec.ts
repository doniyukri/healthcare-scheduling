import { jest } from '@jest/globals';
import type { Doctor } from '../generated/prisma/client.js';
import type { CacheService } from '../cache/cache.service.js';
import type { DoctorsRepository } from './doctors.repository.js';
import { DoctorsService } from './doctors.service.js';
import { PaginationInput } from '../common/pagination/pagination.js';

const doctor: Doctor = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'dr. Maya Sari',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createService() {
  const repository = {
    findMany: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countSchedules: jest.fn(),
  };
  const cache = {
    key: jest.fn((namespace: string, suffix: string) => Promise.resolve(`${namespace}:${suffix}`)),
    staticKey: jest.fn((namespace: string, suffix: string) => `${namespace}:${suffix}`),
    lookup: jest.fn(),
    store: jest.fn(),
    delete: jest.fn(),
    bumpVersion: jest.fn(),
  };

  return {
    service: new DoctorsService(
      repository as unknown as DoctorsRepository,
      cache as unknown as CacheService,
    ),
    repository,
    cache,
  };
}

describe('DoctorsService', () => {
  it('creates a doctor and invalidates the list cache', async () => {
    const { service, repository, cache } = createService();
    repository.create.mockResolvedValue(doctor);

    await expect(service.create({ name: 'dr. Maya Sari' })).resolves.toMatchObject({
      id: doctor.id,
    });
    expect(cache.bumpVersion).toHaveBeenCalledWith('doctors');
  });

  it('rejects an empty update', async () => {
    const { service } = createService();

    await expect(service.update(doctor.id, {})).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('maps a missing doctor on update to DOCTOR_NOT_FOUND', async () => {
    const { service, repository } = createService();
    repository.update.mockRejectedValue(Object.assign(new Error('missing'), { code: 'P2025' }));

    await expect(service.update(doctor.id, { name: 'New' })).rejects.toMatchObject({
      code: 'DOCTOR_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('rejects deletion when the doctor has schedules', async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(doctor);
    repository.countSchedules.mockResolvedValue(1);

    await expect(service.delete(doctor.id)).rejects.toMatchObject({
      code: 'DOCTOR_HAS_SCHEDULES',
      statusCode: 409,
    });
  });

  it('maps a concurrent foreign-key violation to DOCTOR_HAS_SCHEDULES', async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(doctor);
    repository.countSchedules.mockResolvedValue(0);
    repository.delete.mockRejectedValue(Object.assign(new Error('fk'), { code: 'P2003' }));

    await expect(service.delete(doctor.id)).rejects.toMatchObject({
      code: 'DOCTOR_HAS_SCHEDULES',
    });
  });

  it('deletes a doctor without schedules', async () => {
    const { service, repository, cache } = createService();
    repository.findById.mockResolvedValue(doctor);
    repository.countSchedules.mockResolvedValue(0);
    repository.delete.mockResolvedValue(doctor);

    await expect(service.delete(doctor.id)).resolves.toMatchObject({ id: doctor.id });
    expect(cache.bumpVersion).toHaveBeenCalledWith('doctors');
  });

  it('returns a cached doctor', async () => {
    const { service, repository, cache } = createService();
    cache.lookup.mockResolvedValue({ hit: true, value: doctor });

    await expect(service.findOne(doctor.id)).resolves.toMatchObject({ id: doctor.id });
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('throws DOCTOR_NOT_FOUND for a cached miss', async () => {
    const { service, cache } = createService();
    cache.lookup.mockResolvedValue({ hit: true, value: null });

    await expect(service.findOne(doctor.id)).rejects.toMatchObject({ code: 'DOCTOR_NOT_FOUND' });
  });

  it('loads and caches a doctor on a miss', async () => {
    const { service, repository, cache } = createService();
    cache.lookup.mockResolvedValue({ hit: false, value: null });
    repository.findById.mockResolvedValue(doctor);

    await expect(service.findOne(doctor.id)).resolves.toMatchObject({ id: doctor.id });
    expect(cache.store).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ id: doctor.id }));
  });

  it('lists doctors with a name filter and pagination', async () => {
    const { service, repository, cache } = createService();
    cache.lookup.mockResolvedValue({ hit: false, value: null });
    repository.findMany.mockResolvedValue([doctor]);
    repository.count.mockResolvedValue(1);

    const page = await service.findMany({ search: 'maya' }, new PaginationInput());

    expect(repository.findMany).toHaveBeenCalledWith(
      { name: { contains: 'maya', mode: 'insensitive' } },
      0,
      10,
    );
    expect(page.items).toHaveLength(1);
    expect(cache.store).toHaveBeenCalled();
  });

  it('returns a cached doctor list', async () => {
    const { service, repository, cache } = createService();
    const cached = { items: [], pageInfo: { total: 0 } };
    cache.lookup.mockResolvedValue({ hit: true, value: cached });

    await expect(service.findMany(undefined, new PaginationInput())).resolves.toBe(cached);
    expect(repository.findMany).not.toHaveBeenCalled();
  });
});
