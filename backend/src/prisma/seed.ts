import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../shared/utils/password.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding FlowTask database...');

  const password = await hashPassword('Password1');

  await prisma.user.upsert({
    where: { email: 'admin@flowtask.dev' },
    update: {},
    create: {
      email: 'admin@flowtask.dev',
      password,
      name: 'Admin',
    },
  });

  await prisma.user.upsert({
    where: { email: 'user@flowtask.dev' },
    update: {},
    create: {
      email: 'user@flowtask.dev',
      password,
      name: 'Demo User',
    },
  });

  console.log('Seed complete. Users: admin@flowtask.dev, user@flowtask.dev (password: Password1)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
