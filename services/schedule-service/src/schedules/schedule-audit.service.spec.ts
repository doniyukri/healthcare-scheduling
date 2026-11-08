import { jest } from '@jest/globals';
import type { AuthenticatedUser } from '../auth-client/auth-client.types.js';
import type { Customer, Doctor } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ScheduleWithRelations } from './entities/schedule.entity.js';
import { ScheduleAuditService } from './schedule-audit.service.js';

const actor: AuthenticatedUser = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'admin@clinic.local',
};

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
  const create = jest.fn(async (): Promise<Record<string, unknown>> => ({}));
  const prisma = { auditLog: { create } } as unknown as PrismaService;

  return { service: new ScheduleAuditService(prisma), create };
}

describe('ScheduleAuditService', () => {
  it('writes an immutable audit entry with the actor and schedule snapshot', async () => {
    const { service, create } = createService();

    await service.record('SCHEDULE_CREATED', schedule, actor);

    expect(create).toHaveBeenCalledWith({
      data: {
        action: 'SCHEDULE_CREATED',
        entity: 'schedule',
        entityId: schedule.id,
        actorId: actor.id,
        actorEmail: actor.email,
        metadata: {
          objective: schedule.objective,
          customerId: schedule.customerId,
          doctorId: schedule.doctorId,
          scheduledAt: schedule.scheduledAt.toISOString(),
        },
      },
    });
  });

  it('records deletions with the deleted action', async () => {
    const { service, create } = createService();

    await service.record('SCHEDULE_DELETED', schedule, actor);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'SCHEDULE_DELETED' }) }),
    );
  });

  it('never fails the mutation when the audit write fails', async () => {
    const { service, create } = createService();
    create.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(service.record('SCHEDULE_CREATED', schedule, actor)).resolves.toBeUndefined();
  });
});
