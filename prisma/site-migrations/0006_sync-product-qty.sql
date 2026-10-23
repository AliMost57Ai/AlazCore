-- مایگریشن 0006_sync-product-qty.sql — ترمیم داده (بدون تغییر DDL).
-- از این پس Product.qty برای کالای نوع‌دار در همان تراکنشِ کسر/برگشتِ سفارش
-- هم‌گام نگه داشته می‌شود (lib/shop-orders.ts و مسیرهای برگشت)؛ این فایل
-- موجودی انباشتهٔ قدیمی را با جمع نوع‌ها هم‌تراز می‌کند تا کارت‌ها، هشدارهای
-- موجودی و شمارش کسری خالی‌فروشی از همان ابتدا درست باشند. اجرای مجدد بی‌اثر
-- است (ledger) و روی دیتابیس نو هم بی‌ضرر (محصولی ندارد).

-- DataRepair: کالای نوع‌دار → موجودی کل = جمع موجودی نوع‌ها
UPDATE "Product"
SET "qty" = (
    SELECT COALESCE(SUM("ProductVariant"."qty"), 0)
    FROM "ProductVariant"
    WHERE "ProductVariant"."productId" = "Product"."id"
)
WHERE EXISTS (
    SELECT 1 FROM "ProductVariant" WHERE "ProductVariant"."productId" = "Product"."id"
);
