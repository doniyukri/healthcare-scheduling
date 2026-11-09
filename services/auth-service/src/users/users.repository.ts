import { Injectable } from '@nestjs/common';
import { DomainError } from '../common/errors/domain.error.js';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: { email: string; password: string }): Promise<User> {
    try {
      return await this.prisma.user.create({ data });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new DomainError(
          'EMAIL_ALREADY_EXISTS',
          'An account with this email already exists',
          409,
        );
      }

      throw error;
    }
  }
}
