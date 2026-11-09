import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL ?? process.env.AUTH_DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL (or AUTH_DATABASE_URL) must be set');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const email = (process.env.DEMO_USER_EMAIL ?? 'admin@clinic.local').trim().toLowerCase();
    const password = process.env.DEMO_USER_PASSWORD ?? 'Password123';
    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
    const passwordHash = await bcrypt.hash(password, rounds);

    const user = await prisma.user.upsert({
      where: { email },
      update: { password: passwordHash },
      create: { email, password: passwordHash },
    });

    console.log(`[seed] demo user ready: ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] failed', error);
  process.exit(1);
});
