import { Injectable } from '@nestjs/common';
import type { Customer, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(where: Prisma.CustomerWhereInput, skip: number, take: number): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where,
      skip,
      take,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  count(where: Prisma.CustomerWhereInput): Promise<number> {
    return this.prisma.customer.count({ where });
  }

  findById(id: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { email } });
  }

  create(data: Prisma.CustomerCreateInput): Promise<Customer> {
    return this.prisma.customer.create({ data });
  }

  update(id: string, data: Prisma.CustomerUpdateInput): Promise<Customer> {
    return this.prisma.customer.update({ where: { id }, data });
  }

  delete(id: string): Promise<Customer> {
    return this.prisma.customer.delete({ where: { id } });
  }

  countSchedules(customerId: string): Promise<number> {
    return this.prisma.schedule.count({ where: { customerId } });
  }
}
