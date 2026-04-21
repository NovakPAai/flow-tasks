import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const KEEP = [
  'novak.pavel@flowtask.dev',
  'user@flowtask.dev',
  'admin@flowtask.dev',
];

async function main() {
  const all = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  const toDelete = all.filter(u => !KEEP.includes(u.email));

  if (toDelete.length === 0) {
    console.log('Нечего удалять.');
    return;
  }

  console.log('Будут удалены:');
  toDelete.forEach(u => console.log(`  - ${u.email} (${u.name})`));

  const ids = toDelete.map(u => u.id);
  await prisma.workspace.deleteMany({ where: { creatorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });

  console.log(`Удалено ${toDelete.length} пользователей.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
