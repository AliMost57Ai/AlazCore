/**
 * حذف قلم از سفارش پرداخت‌شده — مالک قلمی را که قابل ارسال نیست (مثلاً
 * خالی‌فروشی که موجودی‌اش تامین نشد) از سفارش برمی‌دارد: decrement همان
 * قلم پس گرفته می‌شود (برای خط خالی‌فروشی یعنی آزادشدن سهمیه)، سهم
 * تناسبی مشتری از مبلغ کالاها به کیف پولش برمی‌گردد و توضیح اجباری روی
 * سفارش می‌نشیند که مشتری در کارت سفارشش می‌بیند.
 *
 * مبلغ سفارش دست نمی‌خورد — مانند مرجوعی‌ها، تاریخچه مالی سالم می‌ماند و
 * برگشت پول در دفتر کیف پول ثبت است.
 */

import prisma from './db';
import { parseOrderLinesWithIds } from './order-cancel';
import { computeRefundAmount } from './return-status';
import { creditWallet } from './wallet';

const NOTE_MIN = 3;
const NOTE_MAX = 300;

export type RemoveItemResult =
  | { ok: true; refunded: number; remainingLines: number }
  | { error: string };

export async function removeOrderItem(input: {
  displayId: string;
  productId: string;
  variantId: string | null;
  note: string;
}): Promise<RemoveItemResult> {
  const note = input.note.trim();
  if (note.length < NOTE_MIN || note.length > NOTE_MAX) {
    return { error: `توضیح برای مشتری الزامی است (${NOTE_MIN} تا ${NOTE_MAX} نویسه).` };
  }

  const order = await prisma.order.findUnique({ where: { displayId: input.displayId } });
  if (!order) {
    return { error: 'سفارش یافت نشد.' };
  }
  if (order.status !== 'paid' && order.status !== 'boxing') {
    return { error: 'حذف قلم فقط برای سفارش پرداخت‌شده و پیش از ارسال ممکن است.' };
  }

  const lines = parseOrderLinesWithIds(order.itemsJson);
  const line = lines.find(
    (candidate) =>
      candidate.productId === input.productId &&
      (candidate.variantId ?? null) === (input.variantId ?? null)
  );
  if (!line) {
    return { error: 'این قلم در سفارش یافت نشد.' };
  }
  if (lines.length === 1) {
    return { error: 'تنها قلم سفارش همین است — برای کل سفارش از «لغو سفارش» استفاده کنید.' };
  }

  // سهم تناسبی همین قلم از مبلغ پرداختی کالاها — همان فرمول مرجوعی‌ها.
  const paidGoodsTotal = Math.max(order.amount - order.discountAmount, 0);
  const refund = computeRefundAmount([line], lines, paidGoodsTotal);
  if (refund <= 0) {
    return { error: 'مبلغ بازگشتی این قلم صفر است — حذف انجام نشد.' };
  }

  await prisma.$transaction(async (tx) => {
    // پس‌گرفتن decrement ثبت سفارش — همیشه درست است: واحد رزروشده به قفسه
    // برمی‌گردد و برای خط خالی‌فروشی یعنی آزادشدن همان سهمیه.
    if (line.variantId) {
      await tx.productVariant.updateMany({
        where: { id: line.variantId },
        data: { qty: { increment: line.qty } },
      });
      // موجودی کل محصول هم قرینهٔ کسرِ ثبت سفارش برمی‌گردد.
      await tx.product.updateMany({
        where: { id: line.productId },
        data: { qty: { increment: line.qty } },
      });
    } else {
      await tx.product.updateMany({
        where: { id: line.productId },
        data: { qty: { increment: line.qty } },
      });
    }

    if (order.userId && refund > 0) {
      await creditWallet(tx, {
        userId: order.userId,
        amount: refund,
        type: 'refund',
        reason: `حذف کالا از سفارش ${order.displayId}`,
        orderId: order.id,
      });
    }

    const remaining = lines.filter((candidate) => candidate !== line);
    await tx.order.update({
      where: { id: order.id },
      data: {
        itemsJson: JSON.stringify(remaining),
        shopNote: note,
        shopNoteAt: new Date(),
      },
    });
  });

  return { ok: true, refunded: refund, remainingLines: lines.length - 1 };
}
