/**
 * بازرسی تنظیمات/تراکنش‌های درگاه در دیتابیس یک سایت — دود-تست قاعده «در
 * حال استفاده». Usage: npx tsx scripts/check-gateway-usage.ts <domain> <gatewayId>
 */

import path from 'node:path';
import { createPrismaClient } from '../lib/prisma-adapter';

const domainArg = process.argv[2] ?? 'shop2.ir';
const gateway = (process.argv[3] ?? 'mellat').toLowerCase();
const url = `file:${path
  .join(process.cwd(), 'data', 'sites', domainArg, `${domainArg}.db`)
  .replace(/\\/g, '/')}`;
const prisma = createPrismaClient(url);

async function main() {
  const keys = await (
    prisma as unknown as {
      appConfig: {
        findMany: (args: {
          where: { key: { startsWith: string } };
          select: { key: true; value: true };
        }) => Promise<{ key: string; value: string }[]>;
      };
    }
  ).appConfig.findMany({
    where: { key: { startsWith: gateway } },
    select: { key: true, value: true },
  });
  console.log(`appConfig keys starting with "${gateway}":`, JSON.stringify(keys));

  const tx = await (
    prisma as unknown as {
      onlinePaymentTransaction: {
        groupBy: (args: {
          by: string[];
          _count: { _all: true };
        }) => Promise<{ gateway: string; _count: { _all: number } }[]>;
      };
    }
  ).onlinePaymentTransaction.groupBy({ by: ['gateway'], _count: { _all: true } });
  console.log('transaction gateways:', JSON.stringify(tx));

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('ERR', error.message);
  process.exit(1);
});
