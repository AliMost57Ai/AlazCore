-- مایگریشن 0007_return-refunded-amount.sql — افزودن ستون مبلغ واریزشدهٔ مرجوعی.
-- تسویه مرجوعی حالا از بازگشت جزئی پشتیبانی می‌کند: مبلغ محاسبه‌شده در
-- refundItemsAmount قفل می‌ماند (برای ممیزی) و مبلغ نهایی واقعاً واریزشده در
-- refundedAmount ثبت می‌شود (null = تسویه نشده).

-- @if-no-column ReturnRequest.refundedAmount
ALTER TABLE "ReturnRequest" ADD COLUMN "refundedAmount" INTEGER;
