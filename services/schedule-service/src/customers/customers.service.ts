import { Injectable, Logger } from '@nestjs/common';
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
import { CustomersRepository } from './customers.repository.js';
import type { CustomerFilterInput } from './dto/customer-filter.input.js';
import type { CreateCustomerInput } from './dto/create-customer.input.js';
import type { UpdateCustomerInput } from './dto/update-customer.input.js';
import {
  toCustomerEntity,
  type CustomerEntity,
} from './entities/customer.entity.js';
import type { CustomerConnection } from './entities/customer-connection.entity.js';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly customers: CustomersRepository,
    private readonly cache: CacheService,
  ) {}

  async create(input: CreateCustomerInput): Promise<CustomerEntity> {
    try {
      const customer = await this.customers.create({
        name: input.name,
        email: input.email,
      });

      await this.invalidateLists();
      return toCustomerEntity(customer);
    } catch (error) {
      mapPrismaError(error, {
        P2002: () =>
          new DomainError(
            'CUSTOMER_ALREADY_EXISTS',
            'A customer with this email already exists',
            409,
          ),
      });
    }
  }

  async update(id: string, input: UpdateCustomerInput): Promise<CustomerEntity> {
    if (input.name === undefined && input.email === undefined) {
      throw new DomainError('VALIDATION_ERROR', 'At least one field must be provided', 400);
    }

    try {
      const customer = await this.customers.update(id, {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.email === undefined ? {} : { email: input.email }),
      });

      await Promise.all([this.invalidateLists(), this.invalidateDetail(id)]);
      return toCustomerEntity(customer);
    } catch (error) {
      mapPrismaError(error, {
        P2025: () => new DomainError('CUSTOMER_NOT_FOUND', 'Customer not found', 404),
        P2002: () =>
          new DomainError(
            'CUSTOMER_ALREADY_EXISTS',
            'A customer with this email already exists',
            409,
          ),
      });
    }
  }

  async delete(id: string): Promise<CustomerEntity> {
    const existing = await this.customers.findById(id);

    if (!existing) {
      throw new DomainError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
    }

    if ((await this.customers.countSchedules(id)) > 0) {
      throw new DomainError(
        'CUSTOMER_HAS_SCHEDULES',
        'Customer has schedules and cannot be deleted',
        409,
      );
    }

    try {
      const customer = await this.customers.delete(id);
      await Promise.all([this.invalidateLists(), this.invalidateDetail(id)]);
      return toCustomerEntity(customer);
    } catch (error) {
      mapPrismaError(error, {
        P2025: () => new DomainError('CUSTOMER_NOT_FOUND', 'Customer not found', 404),
        // A concurrent insert between the count and the delete.
        P2003: () =>
          new DomainError(
            'CUSTOMER_HAS_SCHEDULES',
            'Customer has schedules and cannot be deleted',
            409,
          ),
      });
    }
  }

  async findOne(id: string): Promise<CustomerEntity> {
    const key = this.cache.staticKey(CACHE_NAMESPACES.customers, `detail:${id}`);
    const cached = await this.cache.lookup<CustomerEntity>(key);

    if (cached.hit) {
      if (!cached.value) {
        throw new DomainError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
      }

      return cached.value;
    }

    const customer = await this.customers.findById(id);

    if (!customer) {
      await this.cache.store(key, null);
      throw new DomainError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
    }

    const entity = toCustomerEntity(customer);
    await this.cache.store(key, entity);
    return entity;
  }

  async findMany(
    filter: CustomerFilterInput | undefined,
    pagination: PaginationInput,
  ): Promise<CustomerConnection> {
    const key = await this.cache.key(
      CACHE_NAMESPACES.customers,
      `list:${JSON.stringify({
        search: filter?.search ?? null,
        email: filter?.email ?? null,
        page: pagination.page,
        limit: pagination.limit,
      })}`,
    );
    const cached = await this.cache.lookup<CustomerConnection>(key);

    if (cached.hit && cached.value) {
      return cached.value;
    }

    const where = this.buildWhere(filter);
    const { skip, take } = toSkipTake(pagination);
    const [items, total] = await Promise.all([
      this.customers.findMany(where, skip, take),
      this.customers.count(where),
    ]);

    const connection: CustomerConnection = {
      items: items.map(toCustomerEntity),
      pageInfo: buildPageInfo(pagination.page, pagination.limit, total),
    };

    await this.cache.store(key, connection);
    return connection;
  }

  private buildWhere(filter: CustomerFilterInput | undefined): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = {};

    if (filter?.email) {
      where.email = filter.email;
    }

    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private async invalidateLists(): Promise<void> {
    await this.cache.bumpVersion(CACHE_NAMESPACES.customers);
  }

  private async invalidateDetail(id: string): Promise<void> {
    const key = this.cache.staticKey(CACHE_NAMESPACES.customers, `detail:${id}`);
    await this.cache.delete(key);
    this.logger.debug(`Invalidated customer cache ${id}`);
  }
}
