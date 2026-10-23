/**
 * یک‌بار اجرا — ترمیم موجودی کل دیتابیس توسعه (data/app.db) مطابق
 * prisma/site-migrations/0006_sync-product-qty.sql. دیتابیس‌های سایت همین
 * فایل را خودکار (ledger) می‌گیرند؛ دیتابیس اصلی dev از مسیر مایگریشن سایت
 * رد نمی‌شود، پس همین اسکریپت هم‌ارزشش است. Idempotent.
 */
import { createPrismaClient } from '../lib/prisma-adapter';

const prisma = createPrismaClient();

const REPAIR = `
UPDATE "Product"
SET "qty" = (
    SELECT COALESCE(SUM("ProductVariant"."qty"), 0)
    FROM "ProductVariant"
    WHERE "ProductVariant"."productId" = "Product"."id"
)
WHERE EXISTS (
    SELECT 1 FROM "ProductVariant" WHERE "ProductVariant"."productId" = "Product"."id"
)
`;

async function main(): Promise<void> {
  const before = await prisma.$queryRawUnsafe<{ id: string; name: string; qty: number }[]>(
    'SELECT id, name, qty FROM "Product" WHERE EXISTS (SELECT 1 FROM "ProductVariant" WHERE "ProductVariant"."productId" = "Product"."id") AND "qty" != (SELECT COALESCE(SUM("qty"), 0) FROM "ProductVariant" WHERE "ProductVariant"."productId" = "Product"."id")'
  );
  console.log(`products out of sync before repair: ${before.length}`);
  for (const row of before) {
    console.log(`  - ${row.name}: qty=${row.qty}`);
  }

  await prisma.$executeRawUnsafe(REPAIR);

  const after = await prisma.$queryRawUnsafe<{ id: string }[]>(
    'SELECT id FROM "Product" WHERE EXISTS (SELECT 1 FROM "ProductVariant" WHERE "ProductVariant"."productId" = "Product"."id") AND "qty" != (SELECT COALESCE(SUM("qty"), 0) FROM "ProductVariant" WHERE "ProductVariant"."productId" = "Product"."id")'
  );
  console.log(`products out of sync after repair: ${after.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
