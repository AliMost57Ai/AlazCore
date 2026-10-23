/** چک ستون‌های جدید در دیتابیس اصلی — دیباگ db push. */

import { createPrismaClient } from '../lib/prisma-adapter';

const prisma = createPrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM pragma_table_info('Product')"
  );
  console.log(
    'Product cols:',
    cols
      .map((c) => c.name)
      .filter((n) => n.includes('reorder') || n.includes('minStock') || n === 'qty')
  );
  const orderCols = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM pragma_table_info('Order')"
  );
  console.log(
    'Order cols:',
    orderCols.map((c) => c.name).filter((n) => n.includes('oversell'))
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
