/**
 * تست مستقیم raw query روی دیتابیس سایت — دیباگ قاعده «در حال استفاده».
 * Usage: npx tsx scripts/raw-debug.ts
 */

import path from 'node:path';
import { createPrismaClient } from '../lib/prisma-adapter';

const url = `file:${path
  .join(process.cwd(), 'data', 'sites', 'shop2.ir', 'shop2.ir.db')
  .replace(/\\/g, '/')}`;
const prisma = createPrismaClient(url);

async function main() {
  console.log('url:', url);
  // شبیه‌سازی: مالک تنظیمات ملت را وارد کرده است
  await (
    prisma as unknown as {
      appConfig: {
        upsert: (args: {
          where: { key: string };
          update: { value: string };
          create: { key: string; value: string };
        }) => Promise<unknown>;
      };
    }
  ).appConfig.upsert({
    where: { key: 'mellatTerminalId' },
    update: { value: '12345678' },
    create: { key: 'mellatTerminalId', value: '12345678' },
  });
  console.log('simulated mellatTerminalId inserted');
  const all = await (
    prisma as unknown as {
      appConfig: {
        findMany: (args: {
          select: { key: true; value: true };
        }) => Promise<{ key: string; value: string }[]>;
      };
    }
  ).appConfig.findMany({ select: { key: true, value: true } });
  console.log('all appConfig rows:', JSON.stringify(all));

  const raw = await prisma.$queryRawUnsafe<unknown[]>(
    "SELECT key, value FROM AppConfig WHERE key LIKE ? || '%' AND TRIM(value) <> '' LIMIT 1",
    'mellat'
  );
  console.log('raw like result:', JSON.stringify(raw));

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('ERR', error.message);
  process.exit(1);
});
