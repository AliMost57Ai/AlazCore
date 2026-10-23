-- مایگریشن پایه — تبدیل «لیست مهاجرت سبک» سابق ensureSiteDb به فایل.
-- روی دیتابیس‌های قدیمی که بعضی ستون‌ها/جدول‌هایشان از قبل اعمال شده، گاردهای
-- @if-no-column مانع خطای «duplicate column» می‌شوند؛ روی دیتابیس نو که schema
-- تجمعی site-schema.sql را دارد همه‌ی دستورها رد می‌شوند (idempotent).
-- مایگریشن‌های بعدی (0002 به بعد) با scripts/new-site-migration.ts تولید و
-- بدون گارد اعمال می‌شوند — چون ledger نسخه‌ی هر دیتابیس را دقیق نگه می‌دارد.

-- @if-no-column Product.reorderPoint
ALTER TABLE "Product" ADD COLUMN "reorderPoint" INTEGER;

-- @if-no-column Product.minStock
ALTER TABLE "Product" ADD COLUMN "minStock" INTEGER;

-- @if-no-column Product.oversellAllowed
ALTER TABLE "Product" ADD COLUMN "oversellAllowed" BOOLEAN NOT NULL DEFAULT false;

-- @if-no-column Product.oversellMax
ALTER TABLE "Product" ADD COLUMN "oversellMax" INTEGER;

-- @if-no-column Order.oversell
ALTER TABLE "Order" ADD COLUMN "oversell" BOOLEAN NOT NULL DEFAULT false;

-- @if-no-column Order.oversellQty
ALTER TABLE "Order" ADD COLUMN "oversellQty" INTEGER NOT NULL DEFAULT 0;

-- @if-no-column Order.shopNote
ALTER TABLE "Order" ADD COLUMN "shopNote" TEXT;

-- @if-no-column Order.shopNoteAt
ALTER TABLE "Order" ADD COLUMN "shopNoteAt" DATETIME;

-- @if-no-column Order.pickupLocationId
ALTER TABLE "Order" ADD COLUMN "pickupLocationId" TEXT;

-- @if-no-column Order.pickupSlotId
ALTER TABLE "Order" ADD COLUMN "pickupSlotId" TEXT;

-- @if-no-column Order.pickupDate
ALTER TABLE "Order" ADD COLUMN "pickupDate" TEXT;

-- @if-no-column Order.pickupChangeNote
ALTER TABLE "Order" ADD COLUMN "pickupChangeNote" TEXT;

-- @if-no-column Order.pickupChangeAt
ALTER TABLE "Order" ADD COLUMN "pickupChangeAt" DATETIME;

-- @if-no-column Order.deliveredAt
ALTER TABLE "Order" ADD COLUMN "deliveredAt" DATETIME;

-- @if-no-column ShippingMethod.kind
ALTER TABLE "ShippingMethod" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'courier';

-- @if-no-column ShippingMethod.pickupLocationId
ALTER TABLE "ShippingMethod" ADD COLUMN "pickupLocationId" TEXT;

-- @if-no-column OnlinePaymentTransaction.cardPan
ALTER TABLE "OnlinePaymentTransaction" ADD COLUMN "cardPan" TEXT;

-- @if-no-column OnlinePaymentTransaction.verifyPayload
ALTER TABLE "OnlinePaymentTransaction" ADD COLUMN "verifyPayload" TEXT;

-- جداول تحویل حضوری و مرجوعی کالا برای دیتابیس‌های ساخته‌شده پیش از این فیچرها
-- (سایت‌های جدید از site-schema.sql کامل می‌آیند) — IF NOT EXISTS = idempotent.

CREATE TABLE IF NOT EXISTS "PickupLocation" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "address" TEXT NOT NULL, "lat" REAL, "lng" REAL, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS "PickupSlot" ("id" TEXT NOT NULL PRIMARY KEY, "locationId" TEXT NOT NULL, "startMinute" INTEGER NOT NULL, "endMinute" INTEGER NOT NULL, "capacity" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PickupSlot_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PickupLocation" ("id") ON DELETE CASCADE ON UPDATE CASCADE);

CREATE TABLE IF NOT EXISTS "PickupHoliday" ("id" TEXT NOT NULL PRIMARY KEY, "date" TEXT NOT NULL, "title" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS "ReturnRequest" ("id" TEXT NOT NULL PRIMARY KEY, "displayId" TEXT NOT NULL, "orderId" TEXT NOT NULL, "userId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'requested', "reasonKind" TEXT NOT NULL, "reason" TEXT NOT NULL, "imagesJson" TEXT NOT NULL DEFAULT '[]', "itemsJson" TEXT NOT NULL DEFAULT '[]', "refundItemsAmount" INTEGER NOT NULL DEFAULT 0, "shippingPayer" TEXT, "returnMethod" TEXT, "approvalNote" TEXT, "shippingTrackingCode" TEXT, "shippingCost" INTEGER, "shippingReceiptPath" TEXT, "rejectReason" TEXT, "approvedAt" DATETIME, "sentAt" DATETIME, "receivedAt" DATETIME, "refundedAt" DATETIME, "rejectedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "ReturnRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE);

CREATE TABLE IF NOT EXISTS "ReturnEvent" ("id" TEXT NOT NULL PRIMARY KEY, "returnRequestId" TEXT NOT NULL, "toStatus" TEXT NOT NULL, "message" TEXT NOT NULL, "actorRole" TEXT NOT NULL, "actorName" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ReturnEvent_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE);

CREATE UNIQUE INDEX IF NOT EXISTS "PickupHoliday_date_key" ON "PickupHoliday"("date");

CREATE UNIQUE INDEX IF NOT EXISTS "ReturnRequest_displayId_key" ON "ReturnRequest"("displayId");

CREATE INDEX IF NOT EXISTS "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");

CREATE INDEX IF NOT EXISTS "ReturnRequest_userId_idx" ON "ReturnRequest"("userId");

CREATE INDEX IF NOT EXISTS "ReturnRequest_status_idx" ON "ReturnRequest"("status");

CREATE INDEX IF NOT EXISTS "ReturnEvent_returnRequestId_idx" ON "ReturnEvent"("returnRequestId");
