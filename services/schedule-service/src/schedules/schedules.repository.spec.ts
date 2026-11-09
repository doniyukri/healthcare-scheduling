import { jest } from '@jest/globals';
import type { PrismaService } from '../prisma/prisma.service.js';
import { SchedulesRepository } from './schedules.repository.js';

it('propagates an audit failure from the transaction', async () => {
  const failure = new Error('audit unavailable');
  const tx = {
    schedule: { create: jest.fn().mockResolvedValue({ id: 'schedule', scheduledAt: new Date(), customerId: 'customer', doctorId: 'doctor' }) },
    auditLog: { create: jest.fn().mockRejectedValue(failure) },
  };
  const prisma = { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) };
  const repository = new SchedulesRepository(prisma as unknown as PrismaService);
  await expect(repository.create({} as never, { id: 'actor', email: 'actor@example.com' })).rejects.toBe(failure);
  expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
});
