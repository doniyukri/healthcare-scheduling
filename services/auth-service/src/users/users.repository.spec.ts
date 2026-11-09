import { jest } from '@jest/globals';
import type { PrismaService } from '../prisma/prisma.service.js';
import { UsersRepository } from './users.repository.js';

function createRepository() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  return {
    repository: new UsersRepository(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('UsersRepository', () => {
  it('looks a user up by email', async () => {
    const { repository, prisma } = createRepository();
    prisma.user.findUnique.mockResolvedValue(null);

    await repository.findByEmail('user@example.com');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
  });

  it('looks a user up by id', async () => {
    const { repository, prisma } = createRepository();
    prisma.user.findUnique.mockResolvedValue(null);

    await repository.findById('user-1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('creates a user', async () => {
    const { repository, prisma } = createRepository();
    const user = { id: 'user-1', email: 'user@example.com' };
    prisma.user.create.mockResolvedValue(user);

    await expect(repository.create({ email: 'user@example.com', password: 'hash' })).resolves.toBe(
      user,
    );
  });

  it('maps a unique constraint violation to EMAIL_ALREADY_EXISTS', async () => {
    const { repository, prisma } = createRepository();
    prisma.user.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    await expect(
      repository.create({ email: 'user@example.com', password: 'hash' }),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS', statusCode: 409 });
  });

  it('rethrows unrelated database errors', async () => {
    const { repository, prisma } = createRepository();
    const failure = new Error('connection lost');
    prisma.user.create.mockRejectedValue(failure);

    await expect(repository.create({ email: 'user@example.com', password: 'hash' })).rejects.toBe(
      failure,
    );
  });
});
