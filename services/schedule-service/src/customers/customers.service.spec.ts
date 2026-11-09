import { jest } from '@jest/globals';
import type { Customer } from '../generated/prisma/client.js';
import type { CacheService } from '../cache/cache.service.js';
import { CustomersService } from './customers.service.js';
import type { CustomersRepository } from './customers.repository.js';
import { PaginationInput } from '../common/pagination/pagination.js';

const customer: Customer = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Budi Santoso',
  email: 'budi@example.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createService() {
  const repository = {
    findMany: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
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
    service: new CustomersService(
      repository as unknown as CustomersRepository,
      cache as unknown as CacheService,
    ),
    repository,
    cache,
  };
}

describe('CustomersService', () => {
  describe('create', () => {
    it('creates a customer and invalidates the list cache', async () => {
      const { service, repository, cache } = createService();
      repository.create.mockResolvedValue(customer);

      await expect(
        service.create({ name: 'Budi Santoso', email: 'budi@example.com' }),
      ).resolves.toMatchObject({ id: customer.id, email: customer.email });

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Budi Santoso',
        email: 'budi@example.com',
      });
      expect(cache.bumpVersion).toHaveBeenCalledWith('customers');
    });

    it('maps a unique violation to CUSTOMER_ALREADY_EXISTS', async () => {
      const { service, repository } = createService();
      repository.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

      await expect(
        service.create({ name: 'Budi', email: 'budi@example.com' }),
      ).rejects.toMatchObject({ code: 'CUSTOMER_ALREADY_EXISTS', statusCode: 409 });
    });
  });

  describe('update', () => {
    it('rejects an empty patch', async () => {
      const { service, repository } = createService();

      await expect(service.update(customer.id, {})).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('updates only the provided fields and invalidates caches', async () => {
      const { service, repository, cache } = createService();
      repository.update.mockResolvedValue({ ...customer, name: 'Renamed' });

      await expect(service.update(customer.id, { name: 'Renamed' })).resolves.toMatchObject({
        name: 'Renamed',
      });

      expect(repository.update).toHaveBeenCalledWith(customer.id, { name: 'Renamed' });
      expect(cache.bumpVersion).toHaveBeenCalledWith('customers');
      expect(cache.delete).toHaveBeenCalledWith(`customers:detail:${customer.id}`);
    });

    it('maps a missing record to CUSTOMER_NOT_FOUND', async () => {
      const { service, repository } = createService();
      repository.update.mockRejectedValue(Object.assign(new Error('missing'), { code: 'P2025' }));

      await expect(service.update(customer.id, { name: 'X' })).rejects.toMatchObject({
        code: 'CUSTOMER_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  describe('delete', () => {
    it('rejects an unknown customer', async () => {
      const { service, repository } = createService();
      repository.findById.mockResolvedValue(null);

      await expect(service.delete(customer.id)).rejects.toMatchObject({
        code: 'CUSTOMER_NOT_FOUND',
      });
    });

    it('rejects a customer that still has schedules', async () => {
      const { service, repository } = createService();
      repository.findById.mockResolvedValue(customer);
      repository.countSchedules.mockResolvedValue(2);

      await expect(service.delete(customer.id)).rejects.toMatchObject({
        code: 'CUSTOMER_HAS_SCHEDULES',
        statusCode: 409,
      });
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('deletes a customer without schedules', async () => {
      const { service, repository, cache } = createService();
      repository.findById.mockResolvedValue(customer);
      repository.countSchedules.mockResolvedValue(0);
      repository.delete.mockResolvedValue(customer);

      await expect(service.delete(customer.id)).resolves.toMatchObject({ id: customer.id });
      expect(cache.bumpVersion).toHaveBeenCalledWith('customers');
    });

    it('maps a concurrent foreign-key violation to CUSTOMER_HAS_SCHEDULES', async () => {
      const { service, repository } = createService();
      repository.findById.mockResolvedValue(customer);
      repository.countSchedules.mockResolvedValue(0);
      repository.delete.mockRejectedValue(Object.assign(new Error('fk'), { code: 'P2003' }));

      await expect(service.delete(customer.id)).rejects.toMatchObject({
        code: 'CUSTOMER_HAS_SCHEDULES',
      });
    });
  });

  describe('findOne', () => {
    it('returns a cached customer without hitting the database', async () => {
      const { service, repository, cache } = createService();
      cache.lookup.mockResolvedValue({ hit: true, value: { id: customer.id } });

      await expect(service.findOne(customer.id)).resolves.toMatchObject({ id: customer.id });
      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('throws CUSTOMER_NOT_FOUND for a cached miss', async () => {
      const { service, cache } = createService();
      cache.lookup.mockResolvedValue({ hit: true, value: null });

      await expect(service.findOne(customer.id)).rejects.toMatchObject({
        code: 'CUSTOMER_NOT_FOUND',
      });
    });

    it('caches a negative lookup when the customer does not exist', async () => {
      const { service, repository, cache } = createService();
      cache.lookup.mockResolvedValue({ hit: false, value: null });
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(customer.id)).rejects.toMatchObject({
        code: 'CUSTOMER_NOT_FOUND',
      });
      expect(cache.store).toHaveBeenCalledWith(expect.any(String), null);
    });

    it('loads and caches a customer on a miss', async () => {
      const { service, repository, cache } = createService();
      cache.lookup.mockResolvedValue({ hit: false, value: null });
      repository.findById.mockResolvedValue(customer);

      await expect(service.findOne(customer.id)).resolves.toMatchObject({ id: customer.id });
      expect(cache.store).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ id: customer.id }));
    });
  });

  describe('findMany', () => {
    it('returns a cached page', async () => {
      const { service, repository, cache } = createService();
      const cachedPage = { items: [], pageInfo: { total: 0 } };
      cache.lookup.mockResolvedValue({ hit: true, value: cachedPage });

      await expect(service.findMany(undefined, new PaginationInput())).resolves.toBe(cachedPage);
      expect(repository.findMany).not.toHaveBeenCalled();
    });

    it('builds filters, pagination and caches the page', async () => {
      const { service, repository, cache } = createService();
      cache.lookup.mockResolvedValue({ hit: false, value: null });
      repository.findMany.mockResolvedValue([customer]);
      repository.count.mockResolvedValue(1);

      const pagination = new PaginationInput();
      pagination.page = 1;
      pagination.limit = 10;

      const page = await service.findMany({ search: 'budi', email: 'budi@example.com' }, pagination);

      expect(repository.findMany).toHaveBeenCalledWith(
        {
          email: 'budi@example.com',
          OR: [
            { name: { contains: 'budi', mode: 'insensitive' } },
            { email: { contains: 'budi', mode: 'insensitive' } },
          ],
        },
        0,
        10,
      );
      expect(page.pageInfo).toMatchObject({ total: 1, totalPages: 1 });
      expect(cache.store).toHaveBeenCalledWith(expect.any(String), page);
    });
  });
});
