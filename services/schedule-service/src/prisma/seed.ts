import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const CUSTOMER_IDS = [
  '11111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111102',
  '11111111-1111-4111-8111-111111111103',
  '11111111-1111-4111-8111-111111111104',
  '11111111-1111-4111-8111-111111111105',
] as const;

const DOCTOR_IDS = [
  '22222222-2222-4222-8222-222222222201',
  '22222222-2222-4222-8222-222222222202',
  '22222222-2222-4222-8222-222222222203',
] as const;

const SCHEDULE_IDS = [
  '33333333-3333-4333-8333-333333333301',
  '33333333-3333-4333-8333-333333333302',
  '33333333-3333-4333-8333-333333333303',
  '33333333-3333-4333-8333-333333333304',
  '33333333-3333-4333-8333-333333333305',
  '33333333-3333-4333-8333-333333333306',
] as const;

const customers = [
  { name: 'Budi Santoso', email: 'budi.santoso@example.com' },
  { name: 'Siti Rahma', email: 'siti.rahma@example.com' },
  { name: 'Andi Wijaya', email: 'andi.wijaya@example.com' },
  { name: 'Dewi Lestari', email: 'dewi.lestari@example.com' },
  { name: 'Rizky Pratama', email: 'rizky.pratama@example.com' },
];

const doctors = [
  { name: 'dr. Maya Sari, Sp.PD' },
  { name: 'dr. Ahmad Fauzi, Sp.A' },
  { name: 'dr. Linda Kusuma, Sp.OG' },
];

function atUtc(base: Date, hour: number, minute = 0): Date {
  return new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour, minute, 0, 0),
  );
}

function tomorrowUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL ?? process.env.SCHEDULE_DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL (or SCHEDULE_DATABASE_URL) must be set');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const base = tomorrowUtc();

  try {
    for (const [index, customer] of customers.entries()) {
      await prisma.customer.upsert({
        where: { id: CUSTOMER_IDS[index] },
        update: customer,
        create: { id: CUSTOMER_IDS[index], ...customer },
      });
    }

    for (const [index, doctor] of doctors.entries()) {
      await prisma.doctor.upsert({
        where: { id: DOCTOR_IDS[index] },
        update: doctor,
        create: { id: DOCTOR_IDS[index], ...doctor },
      });
    }

    const schedules = [
      {
        id: SCHEDULE_IDS[0],
        objective: 'General consultation',
        customerId: CUSTOMER_IDS[0],
        doctorId: DOCTOR_IDS[0],
        scheduledAt: atUtc(base, 9),
      },
      {
        id: SCHEDULE_IDS[1],
        objective: 'Child vaccination',
        customerId: CUSTOMER_IDS[1],
        doctorId: DOCTOR_IDS[1],
        // Same instant as schedule 1, different doctor: valid, and useful for
        // demonstrating that the conflict rule is per doctor.
        scheduledAt: atUtc(base, 9),
      },
      {
        id: SCHEDULE_IDS[2],
        objective: 'Prenatal checkup',
        customerId: CUSTOMER_IDS[2],
        doctorId: DOCTOR_IDS[2],
        scheduledAt: atUtc(base, 10),
      },
      {
        id: SCHEDULE_IDS[3],
        objective: 'Follow-up blood pressure review',
        customerId: CUSTOMER_IDS[3],
        doctorId: DOCTOR_IDS[0],
        scheduledAt: atUtc(base, 11),
      },
      {
        id: SCHEDULE_IDS[4],
        objective: 'Fever consultation',
        customerId: CUSTOMER_IDS[4],
        doctorId: DOCTOR_IDS[1],
        scheduledAt: atUtc(base, 13),
      },
      {
        id: SCHEDULE_IDS[5],
        objective: 'Routine screening',
        customerId: CUSTOMER_IDS[0],
        doctorId: DOCTOR_IDS[2],
        scheduledAt: atUtc(base, 14),
      },
    ];

    for (const schedule of schedules) {
      await prisma.schedule.upsert({
        where: { id: schedule.id },
        update: schedule,
        create: schedule,
      });
    }

    console.log(
      `[seed] schedule service ready: ${customers.length} customers, ${doctors.length} doctors, ${schedules.length} schedules`,
    );
    console.log(
      `[seed] conflict demo: create a schedule for doctor ${DOCTOR_IDS[0]} at ${atUtc(base, 9).toISOString()}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] failed', error);
  process.exit(1);
});
