/**
 * شمار کاربران یک دیتابیس سایت — ابزار کوچک دود-تست multi-tenancy.
 * Usage: npx tsx scripts/check-site-user.ts <db-relative-path>
 */
import path from 'node:path';
import { createPrismaClient } from '../lib/prisma-adapter';

const rel = process.argv[2] ?? 'data/sites/shop2.ir/shop2.ir.db';
const url = `file:${path.join(process.cwd(), rel).replace(/\\/g, '/')}`;
const prisma = createPrismaClient(url);

prisma.user
  .findMany({ select: { email: true, role: true } })
  .then((users) => {
    console.log(
      `users in ${rel}:`,
      users.length,
      users.map((u) => `${u.email}(${u.role})`).join(', ')
    );
    return prisma.$disconnect();
  })
  .catch((error) => {
    console.error('ERR', error.message);
    process.exit(1);
  });
