import { afterAll } from 'vitest';
import { prisma } from '../prisma/client.js';

afterAll(async () => {
  await prisma.$disconnect();
});
