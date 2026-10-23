'use client';

import type { PickupDayAvailability } from '@/lib/pickup';

/**
 * لایه fetch عملیات تحویل حضوری — مشترک بین جدول تحویل حضوری (مودال دسکتاپ)
 * و صفحات اختصاصی موبایل (تغییر زمان/لغو) تا هر دو مسیر دقیقاً یک API و یک
 * پیام خطا داشته باشند. نوتیفیکیشن و رفرش با caller است.
 */

export type PickupActionResult = { ok: true } | { ok: false; error: string };

export async function markPickupDelivered(orderId: string): Promise<PickupActionResult> {
  try {
    const response = await fetch(`/api/orders/${orderId}/pickup-delivered`, { method: 'POST' });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return response.ok
      ? { ok: true }
      : { ok: false, error: payload.error ?? 'ثبت تحویل ناموفق بود.' };
  } catch {
    return { ok: false, error: 'ارتباط با سرور برقرار نشد.' };
  }
}

export async function cancelPickupOrder(
  orderId: string
): Promise<{ ok: true; refunded: number } | { ok: false; error: string }> {
  try {
    const response = await fetch(`/api/orders/${orderId}/pickup-cancelled`, { method: 'POST' });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      refunded?: number;
    };
    return response.ok
      ? { ok: true, refunded: payload.refunded ?? 0 }
      : { ok: false, error: payload.error ?? 'لغو سفارش ناموفق بود.' };
  } catch {
    return { ok: false, error: 'ارتباط با سرور برقرار نشد.' };
  }
}

export async function notifyPickupCustomer(orderId: string): Promise<PickupActionResult> {
  try {
    const response = await fetch(`/api/orders/${orderId}/pickup-notify`, { method: 'POST' });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return response.ok
      ? { ok: true }
      : { ok: false, error: payload.error ?? 'ارسال پیامک ناموفق بود.' };
  } catch {
    return { ok: false, error: 'ارتباط با سرور برقرار نشد.' };
  }
}

export async function fetchPickupAvailability(
  locationId: string
): Promise<PickupDayAvailability[] | null> {
  try {
    const response = await fetch(
      `/api/pickup/availability?locationId=${encodeURIComponent(locationId)}`
    );
    const payload = (await response.json().catch(() => ({}))) as {
      days?: PickupDayAvailability[];
    };
    return payload.days ?? null;
  } catch {
    return null;
  }
}

export async function reschedulePickupOrder(
  orderId: string,
  body: { date: string; slotId: string; note: string }
): Promise<{ ok: true; dateLabel: string; slotLabel: string } | { ok: false; error: string }> {
  try {
    const response = await fetch(`/api/orders/${orderId}/pickup-reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      dateLabel?: string;
      slotLabel?: string;
    };
    return response.ok
      ? {
          ok: true,
          dateLabel: payload.dateLabel ?? '',
          slotLabel: payload.slotLabel ?? '',
        }
      : { ok: false, error: payload.error ?? 'تغییر برنامه تحویل ناموفق بود.' };
  } catch {
    return { ok: false, error: 'ارتباط با سرور برقرار نشد.' };
  }
}
