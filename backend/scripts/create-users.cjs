const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const USERS = [
  { name: 'Андрей Бурилов',      emailPrefix: 'andrey.burilov' },
  { name: 'Алексей Яковенко',    emailPrefix: 'alexei.yakovenko' },
  { name: 'Екатерина Толкачева', emailPrefix: 'ekaterina.tolkacheva' },
  { name: 'Дмитрий Пузырев',     emailPrefix: 'dmitry.puzirev' },
];

const DOMAIN = 'flowtask.dev';

async function main() {
  for (const u of USERS) {
    const email = `${u.emailPrefix}@${DOMAIN}`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`SKIP (already exists): ${email}`);
      continue;
    }
    const password = crypto.randomBytes(10).toString('base64url');
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { email, name: u.name, password: hash } });
    console.log(`CREATED: ${u.name} | ${email} | password: ${password}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
