const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const KEEP = ['novak.pavel@flowtask.dev', 'user@flowtask.dev', 'admin@flowtask.dev'];

async function main() {
  const all = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  const toDelete = all.filter(u => !KEEP.includes(u.email));

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  console.log('Deleting:', toDelete.map(u => u.email).join(', '));
  const ids = toDelete.map(u => u.id);
  await prisma.workspace.deleteMany({ where: { creatorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log('Done. Deleted:', toDelete.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
