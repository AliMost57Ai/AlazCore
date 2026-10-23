/**
 * کلاینت سمت سرورِ فروشگاه برای API مستأجر پنل Core (تیکتینگ مالک↔سوپرادمین)
 * — سیستم تیکت مالک↔پشتیبان کور با واژه‌نامه نسخه مرجع؛ پنل فروشگاه فقط
 * پراکسی احرازشده است.
 */

import { currentDomain } from './core-license';

function coreConfigured(): boolean {
  return Boolean(process.env.CORE_API_URL && process.env.CORE_API_KEY);
}

async function coreFetch<T>(path: string, init: RequestInit): Promise<T | { error: string }> {
  if (!coreConfigured()) {
    return { error: 'اتصال به سامانه Core پیکربندی نشده است.' };
  }
  const domain = await currentDomain();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${process.env.CORE_API_URL!.replace(/\/+$/, '')}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-core-key': process.env.CORE_API_KEY!,
        'x-core-domain': domain,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return { error: (payload.error as string) ?? 'سامانه Core پاسخ ناموفق داد.' };
    }
    return payload as T;
  } catch (error) {
    return { error: `سامانه Core در دسترس نیست: ${(error as Error).message}` };
  }
}

export interface SupportTicketMessage {
  id: string;
  authorSide: string;
  authorName: string;
  body: string;
  createdAt: string;
}

/** همان ساختار GenericTicket کامپوننت ژنریک. */
export interface SupportTicket {
  id: string;
  displayId: string;
  subject: string;
  status: string;
  requesterName: string;
  counterpart?: string | null;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageAuthor: string;
  requesterReadAt: string | null;
  supporterReadAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessage[];
}

/** تیکت‌های این دامنه از سامانه Core. */
export function listSupportTickets(): Promise<SupportTicket[] | { error: string }> {
  return coreFetch<{ tickets: SupportTicket[] }>('/api/tenant/tickets', { method: 'GET' }).then(
    (result) => ('error' in result ? result : result.tickets)
  );
}

/** یک تیکت با رشته کامل — GET همان سمت markRead مالک هم می‌زند. */
export function getSupportTicket(id: string): Promise<SupportTicket | { error: string }> {
  return coreFetch<{ ticket: SupportTicket }>(`/api/tenant/tickets/${encodeURIComponent(id)}`, {
    method: 'GET',
  }).then((result) => ('error' in result ? result : result.ticket));
}

/** ثبت تیکت جدید از طرف مالک. */
export function createSupportTicket(input: {
  subject: string;
  body: string;
}): Promise<{ id: string } | { error: string }> {
  return coreFetch<{ id: string }>('/api/tenant/tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** پاسخ مالک به تیکت — وضعیت خودکار به open «در انتظار پاسخ» می‌رود. */
export function replySupportTicket(
  id: string,
  input: { body: string }
): Promise<{ ok: true } | { error: string }> {
  return coreFetch<{ ok: true }>(`/api/tenant/tickets/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
