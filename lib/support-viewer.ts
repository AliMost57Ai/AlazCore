/**
 * چه کسی آن طرف گفتگوی پشتیبانی ایستاده — پورت lib/support-auth.ts نسخه مرجع.
 *
 * یک مسیر پشتیبانی سه نوع فراخوان ممکن دارد که همین‌جا از هم تفکیک می‌شوند:
 *  1. مشتری واردشده (role 'customer') — تیکت‌های خودش،
 *  2. پرسنل پنل — گیت منوی /customer-support،
 *  3. مهمان — شناسایی با توکن opaque داخل کوکی mnt_support که موقع دادن نام
 *     و موبایل به او داده شده.
 *
 * Server-only: کوکی و نشست را می‌خواند. نام کوکی در lib/constants.ts است تا
 * کلاینت بدون این ماژول بخواند.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireApiMenu } from './api-auth';
import { getSession } from './auth';
import { SUPPORT_COOKIE } from './constants';
import type { SessionPayload } from './session';

export { SUPPORT_COOKIE, SUPPORT_COOKIE_MAX_AGE } from './constants';

/** منوی پنلی که داشتنش یعنی «پشتیبان». */
const SUPPORT_MENU = '/customer-support';

/** سه نوع فراخوان پشتیبانی، به شکلی که لایه دامین می‌خواهد. */
export type SupportViewer =
  | { kind: 'customer'; userId: string; name: string }
  | { kind: 'guest'; token: string }
  | { kind: 'staff'; session: SessionPayload };

/**
 * بیننده فعلی پشتیبانی، یا null وقتی هیچ‌کس نیست.
 *
 * نشست پرسنلیِ بدون مجوز پشتیبانی به‌جای viewer مقدار null نمی‌شود بلکه رد
 * می‌شود: ویجت فروشگاه نباید به کسی که فقط از پنل جواب می‌دهد چت‌باکس بدهد.
 */
export async function resolveSupportViewer(): Promise<SupportViewer | null> {
  const resolved = await resolveStorefrontViewer();
  return resolved.ok ? resolved.viewer : null;
}

/**
 * دیدِ چت فروشگاه از فراخوان، جایی که «هیچ‌کس» یک جواب عادی است.
 *
 * بازدیدکننده‌ای که نه نشست دارد نه کوکی مهمان خطا نیست — هنوز گفتگویی
 * ندارد — پس viewer: null می‌گیرد. اما کاربر *واردشده*ای که نه مشتری است نه
 * پشتیبانِ مجوزدار، مورد دیگری است و با ۴۰۱/۴۰۳ خود پنل رد می‌شود (از طریق
 * requireApiMenu) تا چنین فراخوانی هرگز به‌اشتباه مهمان فرض نشود و تیکت به
 * نامش باز نشود.
 */
export async function resolveStorefrontViewer(): Promise<
  { ok: true; viewer: SupportViewer | null } | { ok: false; response: NextResponse }
> {
  const session = await getSession();
  if (session) {
    if (session.role === 'customer') {
      return { ok: true, viewer: { kind: 'customer', userId: session.sub, name: session.name } };
    }
    const perms = session.perms ?? [];
    if (session.role === 'admin' || perms.includes('*') || perms.includes(SUPPORT_MENU)) {
      return { ok: true, viewer: { kind: 'staff', session } };
    }
    const refusal = await requireApiMenu(SUPPORT_MENU);
    return refusal instanceof NextResponse
      ? { ok: false, response: refusal }
      : { ok: true, viewer: { kind: 'staff', session } };
  }

  const store = await cookies();
  const token = store.get(SUPPORT_COOKIE)?.value;
  return { ok: true, viewer: token ? { kind: 'guest', token } : null };
}

/** بیننده پشتیبانی یا null — گارد نیمه مشتری/مهمان مسیرها. */
export async function requireSupportViewer(): Promise<SupportViewer | NextResponse> {
  const resolved = await resolveStorefrontViewer();
  if (!resolved.ok) {
    return resolved.response;
  }
  return (
    resolved.viewer ??
    NextResponse.json({ error: 'برای این عملیات باید وارد شوید.' }, { status: 401 })
  );
}

/** بدنه پاسخ مسیرهای مشتری‌محور وقتی پشتیبانی خاموش است. */
export function supportDisabled(): NextResponse {
  return NextResponse.json({ error: 'پشتیبانی آنلاین غیرفعال است.' }, { status: 403 });
}
