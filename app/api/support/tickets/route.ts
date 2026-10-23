import { NextResponse, type NextRequest } from 'next/server';
import {
  createCustomerTicket,
  createGuestTicket,
  listTicketsForCustomer,
  listTicketsForGuestToken,
  listTicketsForStaff,
} from '@/lib/customer-tickets';
import { getAppSettings } from '@/lib/settings';
import {
  resolveStorefrontViewer,
  SUPPORT_COOKIE,
  SUPPORT_COOKIE_MAX_AGE,
  supportDisabled,
} from '@/lib/support-viewer';
import { normalizePhone } from '@/lib/users';

interface TicketBody {
  subject?: unknown;
  body?: unknown;
  /** شناسه‌های مهمان — وقتی فراخوان نشست ندارد الزامی‌اند. */
  name?: unknown;
  phone?: unknown;
}

/**
 * GET /api/support/tickets — تیکت‌های خود فراخوان.
 *
 * مشتری تیکت‌های خودش را می‌بیند، مهمان آن‌هایی که پشت توکن کوکی‌اش هستند و
 * پشتیبان کل لیست (همان رفتار مرجع؛ پنل خودش را از /api/admin/tickets
 * می‌گیرد و این شاخه فقط احتیاط است). بازدیدکننده‌ای که نه نشست دارد نه کوکی،
 * لیست خالی می‌گیرد نه ۴۰۱: ویجت چت این مسیر را از فروشگاه poll می‌کند و
 * «هنوز گفتگویی نداری» جواب صادقانه کسی است که هرگز ننوشته.
 *
 * گیت supportEnabled فقط مسیرهای مشتری/مهمان را می‌بندد؛ پنل سرپا می‌ماند.
 */
export async function GET() {
  const resolved = await resolveStorefrontViewer();
  if (!resolved.ok) {
    return resolved.response;
  }
  const viewer = resolved.viewer;

  if (viewer?.kind === 'staff') {
    return NextResponse.json({ tickets: await listTicketsForStaff() });
  }

  // پشتیبانی خاموش: پنل سرپا می‌ماند، فروشگاه نه.
  const settings = await getAppSettings();
  if (!settings.supportEnabled) {
    return supportDisabled();
  }

  if (viewer === null) {
    return NextResponse.json({ tickets: [] });
  }

  const tickets =
    viewer.kind === 'customer'
      ? await listTicketsForCustomer(viewer.userId)
      : await listTicketsForGuestToken(viewer.token);

  return NextResponse.json({ tickets });
}

/**
 * POST /api/support/tickets — باز کردن تیکت.
 *
 * مشتری واردشده { subject, body } می‌فرستد؛ مهمان { name, phone, body } و
 * کوکی قابلیتی می‌گیرد که بازدیدهای بعدی‌اش را به این تیکت وصل می‌کند.
 * موضوع مهمان از دل پیامش ساخته می‌شود.
 *
 * این تنها مسیر پشتیبانی است که به‌جای require کردن viewer آن را resolve
 * می‌کند: مهمانِ اول‌بار هم نشست دارد هم کوکی ندارد — و دادن همان کوکی
 * دقیقاً کاری است که این مسیر می‌کند.
 */
export async function POST(request: NextRequest) {
  const resolved = await resolveStorefrontViewer();
  if (!resolved.ok) {
    return resolved.response;
  }
  const viewer = resolved.viewer;

  if (viewer?.kind === 'staff') {
    // پرسنل جواب می‌دهند، تیکت باز نمی‌کنند.
    return NextResponse.json({ error: 'کارمندان از این مسیر تیکت ثبت نمی‌کنند.' }, { status: 403 });
  }

  const settings = await getAppSettings();
  if (!settings.supportEnabled) {
    return supportDisabled();
  }

  let body: TicketBody;
  try {
    body = (await request.json()) as TicketBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const message = typeof body.body === 'string' ? body.body : '';

  if (viewer?.kind === 'customer') {
    const result = await createCustomerTicket({
      userId: viewer.userId,
      name: viewer.name,
      subject: typeof body.subject === 'string' ? body.subject : '',
      body: message,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ticket: result.value }, { status: 201 });
  }

  // مهمان: نام و موبایل قبل از اولین پیام الزامی است.
  const phone = typeof body.phone === 'string' ? normalizePhone(body.phone) : null;
  const result = await createGuestTicket({
    name: typeof body.name === 'string' ? body.name : '',
    phone: phone ?? '',
    body: message,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const response = NextResponse.json(
    { ticket: { id: result.value.id, displayId: result.value.displayId } },
    { status: 201 }
  );
  response.cookies.set({
    name: SUPPORT_COOKIE,
    value: result.value.token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SUPPORT_COOKIE_MAX_AGE,
  });
  return response;
}
