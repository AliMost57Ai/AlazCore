/**
 * Customer-facing orders: placing one from the shop cart and listing a
 * customer's own orders.
 *
 * Server-only — prices and stock come from the DB, never from the request
 * body, so a tampered client can't order at a made-up price or past zero stock.
 */

import { currentDomain, getLicense } from './core-license';
import prisma from './db';
import { applyDiscount, faJalaliDate, jalaliMonthName, toFaDigits, toJalali } from './format';
import type { OrderStatus } from './orders';
import { dateLabel, slotLabel } from './pickup';
import { getOrdersReturnState, type OrderReturnState } from './return-eligibility';

export interface OrderItemInput {
  productId: string;
  /** Null = the plain product, no variant. */
  variantId: string | null;
  qty: number;
}

export interface OrderItem {
  productId: string;
  variantId: string | null;
  /** Display name, e.g. 'هدفون گاما — رنگ مشکی'. */
  name: string;
  qty: number;
  /** Toman per unit, resolved from the DB at order time. */
  unitPrice: number;
  /** قیمت روی جلد — قیمت خام پیش از درصد تخفیف محصول (ستون فاکتور مشتری).
   * سفارش‌های قدیمی این فیلد را ندارند؛ فاکتور fallback به unitPrice می‌کند. */
  listPrice?: number;
}

export interface CustomerOrder {
  id: string;
  displayId: string;
  date: string;
  amount: number;
  status: OrderStatus;
  trackingCode: string | null;
  items: OrderItem[];
  /** How many packages the shipment has, and which one this is (1-based). */
  packageIndex: number;
  packageCount: number;
  /** When the order was paid (drives the +3-day delivery estimate). */
  paidAt: Date | null;
  /** Delivery date the admin promised when posting the order. */
  estimatedArrival: Date | null;
  /** تحویل حضوری — جزئیات رزرو مراجعه (null = سفارش ارسالی). */
  pickup: {
    locationTitle: string;
    address: string;
    dateLabel: string;
    slotLabel: string;
  } | null;
  /** آخرین تغییر برنامه تحویل حضوری توسط فروشگاه — علت + زمان تغییر. */
  pickupChange: { note: string; atLabel: string } | null;
  /** آخرین پیام فروشگاه به مشتری (علت لغو، توضیح حذف قلم…). */
  shopNote: string | null;
  /** وضعیت مرجوعی این سفارش — اهلیت درخواست، انقضای مهلت و فهرست درخواست‌ها
   * (فقط در لیست مشتری پر می‌شود؛ lib/return-eligibility.ts). */
  returnWindow?: OrderReturnState | null;
}

/** Dashboard category label for orders placed through the storefront. */
const SHOP_CATEGORY = 'فروشگاه آنلاین';

/** برچسب تاریخ+ساعت تغییر برنامه تحویل — هم‌فرمت lib/pickup. */
function changeAtLabel(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${faJalaliDate(at)} ${toFaDigits(`${pad(at.getHours())}:${pad(at.getMinutes())}`)}`;
}

function toStatus(value: string): OrderStatus {
  return value === 'paid' ||
    value === 'boxing' ||
    value === 'posted' ||
    value === 'shipped' ||
    value === 'delivered' ||
    value === 'cancelled'
    ? value
    : 'pending';
}

/** Parses an order's itemsJson defensively — malformed rows are dropped. */
export function parseItems(json: string): OrderItem[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is OrderItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as OrderItem).productId === 'string' &&
        typeof (item as OrderItem).name === 'string' &&
        typeof (item as OrderItem).qty === 'number' &&
        typeof (item as OrderItem).unitPrice === 'number'
    );
  } catch {
    return [];
  }
}

/** `ORD-` + 5 digits, retried on the (very unlikely) unique collision. */
async function nextDisplayId(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `ORD-${String(10_000 + Math.floor(Math.random() * 90_000))}`;
    const taken = await prisma.order.findUnique({
      where: { displayId: candidate },
      select: { id: true },
    });
    if (!taken) {
      return candidate;
    }
  }
  // Practically unreachable; a timestamp suffix keeps it unique regardless.
  return `ORD-${Date.now().toString().slice(-5)}`;
}

export type PlaceOrderResult =
  | { ok: true; order: CustomerOrder; merged: boolean }
  | { ok: false; error: string };

/**
 * Places an order for a signed-in customer:
 *  1. resolve every line item against the DB (price, name, current stock),
 *  2. conditionally decrement stock (`qty >= n`) so two concurrent carts can
 *     never oversell the same unit,
 *  3. create the order row — all inside one transaction.
 *
 * If the customer already has a pending (unpaid) order, the cart is merged
 * into it instead of opening a second one: matching product+variant lines add
 * up, new lines are appended, and the total is recomputed. The unpaid order is
 * effectively the customer's active basket until they pay it.
 */
export async function placeOrder(
  userId: string,
  customerName: string,
  items: OrderItemInput[]
): Promise<PlaceOrderResult> {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'سبد خرید خالی است.' };
  }

  // Reject obviously bogus payloads before touching the DB.
  for (const item of items) {
    if (typeof item.productId !== 'string' || item.qty < 1 || !Number.isInteger(item.qty)) {
      return { ok: false, error: 'اقلام سبد خرید نامعتبر است.' };
    }
  }

  const resolved: (OrderItem & { currentQty: number })[] = [];
  // List-price total (before Product.discountPercent) — the accounting page's
  // "original price". amount holds the discounted total.
  let baseTotal = 0;
  // خالی‌فروشی — تنظیم پنل Core برای این دامنه.
  const shortfalls: { productId: string; qty: number }[] = [];
  let oversellQtyTotal = 0;
  const oversellSettings = await getLicense(await currentDomain()).then(
    (license) => license?.oversell ?? { allowed: false, max: 0 }
  );
  const resolvedMeta = new Map<string, { oversellMax: number | null }>();

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: { variants: true },
    });

    if (!product || !product.isVisible) {
      return { ok: false, error: 'یکی از محصولات سبد خرید دیگر موجود نیست.' };
    }

    const variant = item.variantId
      ? product.variants.find((row) => row.id === item.variantId)
      : null;
    if (item.variantId && !variant) {
      return { ok: false, error: 'واریانت انتخابی یکی از محصولات دیگر معتبر نیست.' };
    }

    const stock = variant ? variant.qty : product.qty;
    if (stock < item.qty) {
      const label = variant ? `${product.name} — ${variant.name}` : product.name;
      // خالی‌فروشی این کالا فقط با مجوزِ خود کالا (و بعداً سقف کالا)
      if (!product.oversellAllowed) {
        return {
          ok: false,
          error: `خالی‌فروشی برای «${label}» فعال نیست (موجود: ${stock}).`,
        };
      }
      shortfalls.push({ productId: product.id, qty: item.qty - stock });
      oversellQtyTotal += item.qty - stock;
    }

    resolved.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      name: variant ? `${product.name} — ${variant.name}` : product.name,
      qty: item.qty,
      // The product's discount percent applies to the variant price too when
      // the variant doesn't override it — same rule the shop UI displays.
      unitPrice: applyDiscount(variant?.price ?? product.price, product.discountPercent),
      listPrice: variant?.price ?? product.price,
      currentQty: stock,
    });
    resolvedMeta.set(product.id, { oversellMax: product.oversellMax });
    baseTotal += (variant?.price ?? product.price) * item.qty;
  }

  // خالی‌فروشی: مجوز Core شرط ورود است؛ سقف کالا/کل فروشگاه/سقف per-user
  // داخل همان تراکنش کسر موجودی چک می‌شوند — SQLite نویسنده‌ها را سری
  // می‌کند، پس شمارش و ثبت هم‌زمان دیگر قابل رقابت نیستند (TOCTOU بسته).
  let oversell = false;
  let oversellQty = 0;
  if (oversellQtyTotal > 0) {
    if (!oversellSettings.allowed) {
      return { ok: false, error: `خالی‌فروشی برای این سایت فعال نیست — موجودی کافی نیست.` };
    }
    oversell = true;
    oversellQty = oversellQtyTotal;
  }

  const total = resolved.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const displayId = await nextDisplayId();
  const now = new Date();

  // An unpaid order doubles as the active basket — merge instead of stacking
  // a second pending order behind it.
  const pendingOrder = await prisma.order.findFirst({
    where: { userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });

  // خطای تایپ‌دار سقف خالی‌فروشی — از داخل تراکنش بیرون می‌پرد و به پیام
  // فارسی خودش نگاشت می‌شود (نه پیام عمومی STOCK_RACE).
  const capError = { message: '' };

  const order = await prisma
    .$transaction(async (tx) => {
      if (oversell) {
        // شمارش کسری از Product.qty — با همگام‌سازی کسر واریانت، کسری
        // محصولات نوع‌دار هم از همین مسیر دیده می‌شود (قبلاً کور بود).
        const agg = await tx.$queryRawUnsafe<{ productId: number; oversold: number }[]>(
          'SELECT id AS productId, -qty AS oversold FROM Product WHERE qty < 0'
        );
        const currentOversold = agg.reduce((sum, row) => sum + Number(row.oversold), 0);
        // سقف هر کالا: مجموع خالی‌فروشی بازِ همان کالا + کسری جدید ≤ oversellMax کالا
        for (const shortfall of shortfalls) {
          const already = agg
            .filter((row) => Number(row.productId) === Number(shortfall.productId))
            .reduce((sum, row) => sum + Number(row.oversold), 0);
          const cap = resolvedMeta.get(shortfall.productId)?.oversellMax ?? null;
          if (cap != null && already + shortfall.qty > cap) {
            const label = resolved.find((item) => item.productId === shortfall.productId)?.name;
            throw new Error(
              `OVERSELL_PRODUCT_CAP:${label ?? shortfall.productId}:${Math.max(0, cap - already)}`
            );
          }
        }
        if (currentOversold + oversellQtyTotal > oversellSettings.max) {
          throw new Error(
            `OVERSELL_STORE_CAP:${Math.max(0, oversellSettings.max - currentOversold)}`
          );
        }
        // سقف per-user خالی‌فروشی: هر کاربر برای هر کالای خالی‌فروشی حداکثر
        // ۱ واحد — جمع اقلام همان کالا در سفارش‌های غیرلغوشده خودش (شامل
        // سبد pendingِ در حال ادغام) + درخواست جدید نباید از ۱ بگذرد.
        const userOrders = await tx.order.findMany({
          where: { userId, status: { not: 'cancelled' } },
          select: { itemsJson: true },
        });
        const unitsByProduct = new Map<string, number>();
        for (const row of userOrders) {
          for (const line of parseItems(row.itemsJson)) {
            unitsByProduct.set(
              line.productId,
              (unitsByProduct.get(line.productId) ?? 0) + line.qty
            );
          }
        }
        for (const item of resolved) {
          const isOversellLine = shortfalls.some((f) => f.productId === item.productId);
          if (!isOversellLine) {
            continue;
          }
          const owned = unitsByProduct.get(item.productId) ?? 0;
          if (owned + item.qty > 1) {
            throw new Error(`OVERSELL_USER_CAP:${item.name}`);
          }
        }
      }

      // Conditional decrement: matches nothing (updates 0 rows) when stock was
      // taken between the check above and now — then the whole order fails.
      for (const item of resolved) {
        const shortfall = oversell
          ? (shortfalls.find((f) => f.productId === item.productId)?.qty ?? 0)
          : 0;
        // خط با کسری — هر کسری، حتی با موجودی جزئی — بدون شرط gte کاهش
        // می‌یابد (موجودی منفی = خالی‌فروشی) و بقیه خطوط با شرط رقابتی مثل قبل.
        const allowNegative = shortfall > 0;
        const where = allowNegative
          ? { id: item.variantId ?? item.productId }
          : item.variantId
            ? { id: item.variantId, qty: { gte: item.qty } }
            : { id: item.productId, qty: { gte: item.qty } };
        const updated = item.variantId
          ? await tx.productVariant.updateMany({ where, data: { qty: { decrement: item.qty } } })
          : await tx.product.updateMany({ where, data: { qty: { decrement: item.qty } } });

        if (updated.count === 0) {
          throw new Error('STOCK_RACE');
        }

        // موجودی کل محصول هم با کسر واریانت همگام می‌ماند — Product.qty
        // قرارداد نمایش همه‌جا است (کارت‌ها، هشدار موجودی و شمارش کسری
        // خالی‌فروشی) و باید همان لحظه در همین تراکنش کم شود.
        if (item.variantId) {
          await tx.product.updateMany({
            where: { id: item.productId },
            data: { qty: { decrement: item.qty } },
          });
        }
      }

      if (pendingOrder) {
        const existing = parseItems(pendingOrder.itemsJson);
        const merged = [...existing];

        for (const item of resolved) {
          const line = merged.find(
            (candidate) =>
              candidate.productId === item.productId && candidate.variantId === item.variantId
          );
          if (line) {
            line.qty += item.qty;
          } else {
            merged.push({
              productId: item.productId,
              variantId: item.variantId,
              name: item.name,
              qty: item.qty,
              unitPrice: item.unitPrice,
              listPrice: item.listPrice,
            });
          }
        }

        return tx.order.update({
          where: { id: pendingOrder.id },
          data: {
            amount: pendingOrder.amount + total,
            baseAmount: { increment: baseTotal },
            itemsJson: JSON.stringify(merged),
            // پرچم خالی‌فروشی روی خود سفارش — مبنای فیلتر پنل و قفل بسته‌بندی.
            ...(oversell ? { oversell: true, oversellQty: { increment: oversellQty } } : {}),
          },
        });
      }

      return tx.order.create({
        data: {
          displayId,
          customer: customerName,
          date: faJalaliDate(now),
          amount: total,
          baseAmount: baseTotal,
          status: 'pending',
          category: SHOP_CATEGORY,
          month: jalaliMonthName(toJalali(now)[1]),
          userId,
          itemsJson: JSON.stringify(
            resolved.map(({ productId, variantId, name, qty, unitPrice, listPrice }) => ({
              productId,
              variantId,
              name,
              qty,
              unitPrice,
              listPrice,
            }))
          ),
          oversell,
          oversellQty,
        },
      });
    })
    .catch((error: unknown) => {
      // فقط خطای سقف خالی‌فروشی هویت‌دار است؛ بقیه (STOCK_RACE و…) عمومی.
      if (error instanceof Error && error.message.startsWith('OVERSELL_')) {
        capError.message = error.message;
      }
      return null;
    });

  if (!order) {
    if (capError.message.startsWith('OVERSELL_PRODUCT_CAP:')) {
      const [, label, remaining] = capError.message.split(':');
      return {
        ok: false,
        error: `سقف خالی‌فروشی «${label}» پر شده است — ظرفیت باقی‌مانده: ${remaining}.`,
      };
    }
    if (capError.message.startsWith('OVERSELL_STORE_CAP:')) {
      const remaining = capError.message.split(':')[1];
      return {
        ok: false,
        error: `سقف خالی‌فروشی مجاز پر شده است — ظرفیت باقی‌مانده: ${remaining}.`,
      };
    }
    if (capError.message.startsWith('OVERSELL_USER_CAP:')) {
      const label = capError.message.split(':')[1];
      return {
        ok: false,
        error: `هر کاربر حداکثر ۱ عدد از کالای خالی‌فروشی «${label}» می‌تواند بخرد.`,
      };
    }
    return {
      ok: false,
      error: 'موجودی در لحظه ثبت تغییر کرد. سبد خود را به‌روز کنید و دوباره تلاش کنید.',
    };
  }

  return {
    ok: true,
    merged: Boolean(pendingOrder),
    order: {
      id: order.id,
      displayId: order.displayId,
      date: order.date,
      amount: order.amount,
      status: toStatus(order.status),
      trackingCode: order.trackingCode,
      items: parseItems(order.itemsJson),
      // One shipment per order for now — displayed as «بسته ۱ از ۱».
      packageIndex: 1,
      packageCount: 1,
      paidAt: order.paidAt,
      estimatedArrival: order.estimatedArrival,
      // سفارش تازه هنوز checkout نشده — تحویل حضوری در checkout رزرو می‌شود.
      pickup: null,
      pickupChange: null,
      shopNote: order.shopNote,
    },
  };
}

/** A customer's own orders, newest first. */
export async function listCustomerOrders(userId: string): Promise<CustomerOrder[]> {
  const rows = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  // تحویل حضوری — نقطه/بازه در یک دسته کوئری (بدون N+1).
  const locationIds = [
    ...new Set(rows.map((row) => row.pickupLocationId).filter((id): id is string => !!id)),
  ];
  const slotIds = [
    ...new Set(rows.map((row) => row.pickupSlotId).filter((id): id is string => !!id)),
  ];
  const [locations, slots, returnStates] = await Promise.all([
    locationIds.length > 0
      ? prisma.pickupLocation.findMany({
          where: { id: { in: locationIds } },
          select: { id: true, title: true, address: true },
        })
      : Promise.resolve([]),
    slotIds.length > 0
      ? prisma.pickupSlot.findMany({ where: { id: { in: slotIds } } })
      : Promise.resolve([]),
    getOrdersReturnState(
      rows.map((row) => ({
        id: row.id,
        status: row.status,
        deliveredAt: row.deliveredAt,
        paidAt: row.paidAt,
        createdAt: row.createdAt,
      }))
    ),
  ]);
  const locationById = new Map(locations.map((row) => [row.id, row]));
  const slotById = new Map(slots.map((row) => [row.id, row]));

  return rows.map((row) => {
    const location = row.pickupLocationId ? locationById.get(row.pickupLocationId) : undefined;
    const slot = row.pickupSlotId ? slotById.get(row.pickupSlotId) : undefined;
    const isPickup = Boolean(row.pickupSlotId && location && slot);
    return {
      id: row.id,
      displayId: row.displayId,
      date: row.date,
      amount: row.amount,
      status: toStatus(row.status),
      trackingCode: row.trackingCode,
      items: parseItems(row.itemsJson),
      packageIndex: 1,
      packageCount: 1,
      paidAt: row.paidAt,
      estimatedArrival: row.estimatedArrival,
      pickup: isPickup
        ? {
            locationTitle: location?.title ?? '',
            address: location?.address ?? '',
            dateLabel: dateLabel(row.pickupDate ?? ''),
            slotLabel: slotLabel(slot as { startMinute: number; endMinute: number }),
          }
        : null,
      pickupChange: row.pickupChangeNote
        ? {
            note: row.pickupChangeNote,
            atLabel: row.pickupChangeAt ? changeAtLabel(row.pickupChangeAt) : '',
          }
        : null,
      shopNote: row.shopNote,
      returnWindow: returnStates.get(row.id) ?? null,
    };
  });
}
