/**
 * لغو سفارش — منطق مشترک fulfillment و لیست تحویل حضوری: از هر وضعیت
 * غیرپایانی مجاز است؛ سفارش پرداخت‌شده به اندازه همان چه مشتری واقعاً
 * پرداخته به کیف پولش برمی‌گردد و استفاده از کد تخفیف هم پس گرفته می‌شود.
 * پیام اختیاری فروشگاه روی خود سفارش می‌نشیند (shopNote) و مشتری در کارت
 * سفارشش می‌بیند.
 */

import prisma from './db';
import { creditWallet } from './wallet';

export type CancelOrderResult = { ok: true; status: string; refunded: number } | { error: string };

/** خط itemsJson با شناسه‌ها — برای پس‌گرفتن decrement خالی‌فروشی و حذف قلم. */
export interface OrderLineWithIds {
  productId: string;
  variantId: string | null;
  qty: number;
  unitPrice: number;
}

/** itemsJson → خطوط شناسه‌دار؛ ردیف‌های خراب رد می‌شوند. */
export function parseOrderLinesWithIds(itemsJson: string): OrderLineWithIds[] {
  try {
    const parsed: unknown = JSON.parse(itemsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((line): line is Record<string, unknown> => typeof line === 'object' && line !== null)
      .filter(
        (line) =>
          typeof line.productId === 'string' &&
          (line.variantId === null || typeof line.variantId === 'string') &&
          typeof line.qty === 'number' &&
          line.qty > 0
      )
      .map((line) => ({
        productId: line.productId as string,
        variantId: (line.variantId as string | null) ?? null,
        qty: line.qty as number,
        unitPrice: typeof line.unitPrice === 'number' ? (line.unitPrice as number) : 0,
      }));
  } catch {
    return [];
  }
}

export async function cancelOrderById(
  orderId: string,
  shopNote?: string
): Promise<CancelOrderResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return { error: 'سفارش یافت نشد.' };
  }
  if (order.status === 'delivered' || order.status === 'cancelled') {
    return { error: 'این سفارش در وضعیت نهایی است و قابل لغو نیست.' };
  }

  if (!order.userId || !order.paidAt) {
    // سبدِ پرداخت‌نشده — decrement ثبت سفارش پس گرفته می‌شود (خالی‌فروشی:
    // آزادسازی سهمیه) و سفارش بسته می‌شود؛ چیزی پرداخت نشده که برگردد.
    const updated = await prisma.$transaction(async (tx) => {
      if (order.oversell) {
        for (const line of parseOrderLinesWithIds(order.itemsJson)) {
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
        }
      }
      return tx.order.update({
        where: { id: order.id },
        data: {
          status: 'cancelled',
          ...(shopNote ? { shopNote, shopNoteAt: new Date() } : {}),
        },
      });
    });
    return { ok: true, status: updated.status, refunded: 0 };
  }

  // بازگشت همان چه مشتری پرداخته — جمع کالاها منهای تخفیف کد، به‌علاوه هزینه
  // ارسال فاکتورشده (۰ برای پس‌کرایه).
  const refundable = Math.max(order.amount - order.discountAmount + order.shippingCost, 0);
  const updated = await prisma.$transaction(async (tx) => {
    if (refundable > 0) {
      await creditWallet(tx, {
        userId: order.userId as string,
        amount: refundable,
        type: 'refund',
        reason: `لغو سفارش ${order.displayId}`,
        orderId: order.id,
      });
    }
    // کالای تحویل نشده، پس استفاده از کد تخفیف هم پس گرفته می‌شود.
    if (order.couponCode) {
      const coupon = await tx.coupon.findUnique({
        where: { code: order.couponCode },
        select: { id: true },
      });
      if (coupon) {
        await tx.couponRedemption.deleteMany({
          where: { couponId: coupon.id, userId: order.userId as string },
        });
        await tx.coupon.updateMany({
          where: { id: coupon.id, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
    }
    // سفارش خالی‌فروشی هرگز ارسال نمی‌شود — decrement ثبت سفارش پس گرفته
    // می‌شود تا کسری (سهمیه خالی‌فروشی) آزاد شود.
    if (order.oversell) {
      for (const line of parseOrderLinesWithIds(order.itemsJson)) {
        if (line.variantId) {
          await tx.productVariant.updateMany({
            where: { id: line.variantId },
            data: { qty: { increment: line.qty } },
          });
        } else {
          await tx.product.updateMany({
            where: { id: line.productId },
            data: { qty: { increment: line.qty } },
          });
        }
      }
    }
    return tx.order.update({
      where: { id: order.id },
      data: {
        status: 'cancelled',
        ...(shopNote ? { shopNote, shopNoteAt: new Date() } : {}),
      },
    });
  });

  return { ok: true, status: updated.status, refunded: refundable };
}
