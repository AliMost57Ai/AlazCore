/**
 * اعتبارنامه ادمین سایت — سرویسی برای پنل Core تا در صفحه‌ی دامنه نام
 * کاربری/وضعیت رمز ادمینِ همان سایت را نشان دهد و بتواند رمز را به پیش‌فرض
 * بازگرداند (مثلاً وقتی مالک رمزش را فراموش کرده).
 *
 * GET  /api/core/site-admin  → { email, isDefaultPassword }
 * POST /api/core/site-admin  { action: 'reset' } → { email, isDefaultPassword: true }
 *
 * احراز با x-core-key؛ اتصال سایت با هدر x-site-domain (فقط بعد از احراز
 * معتبر است). رمز پیش‌فرض نمایش داده نمی‌شود — در پنل کور به‌صورت ثابت
 * (admin1234) مستند است؛ این API فقط وضعیت آن را برمی‌گرداند.
 */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ensureCoreSiteDb, enterSiteContext } from '@/lib/site-context';
import { ADMIN_HASH, ADMIN_SALT } from '@/lib/site-db';

/** مقایسه ثابت-زمانه کلید مشترک (گارد تایمینگ). */
function keyEquals(provided: string, expected: string): boolean {
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(expected);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function authorize(request: NextRequest): NextResponse | null {
  const expected = process.env.CORE_API_KEY;
  const provided = request.headers.get('x-core-key') ?? '';
  if (!expected) {
    return NextResponse.json(
      { error: 'سرویس Core روی این فروشگاه تنظیم نشده است.' },
      { status: 403 }
    );
  }
  if (!keyEquals(provided, expected)) {
    return NextResponse.json({ error: 'کلید API نامعتبر است.' }, { status: 401 });
  }
  return null;
}

function adminEmailFor(domain: string): string {
  return `admin@${domain}`;
}

/** احراز + resolve دامنه + نشاندن کانتکست در فریم handler — مشترک GET/POST. */
async function authorizeAndBind(
  request: NextRequest
): Promise<{ domain: string } | { error: NextResponse }> {
  const denied = authorize(request);
  if (denied) {
    return { error: denied };
  }
  const domain = await ensureCoreSiteDb(request);
  if (!domain) {
    return {
      error: NextResponse.json(
        { error: 'دامنه ارسال نشده یا دیتابیس سایت آماده نیست.' },
        { status: 400 }
      ),
    };
  }
  enterSiteContext(domain);
  return { domain };
}

export async function GET(request: NextRequest) {
  const bound = await authorizeAndBind(request);
  if ('error' in bound) {
    return bound.error;
  }
  const admin = await prisma.user.findUnique({ where: { email: adminEmailFor(bound.domain) } });
  if (!admin) {
    return NextResponse.json({ error: 'حساب ادمین این سایت یافت نشد.' }, { status: 404 });
  }
  return NextResponse.json({
    email: admin.email,
    isDefaultPassword: admin.salt === ADMIN_SALT && admin.passwordHash === ADMIN_HASH,
  });
}

export async function POST(request: NextRequest) {
  const bound = await authorizeAndBind(request);
  if ('error' in bound) {
    return bound.error;
  }

  let body: { action?: unknown };
  try {
    body = (await request.json()) as { action?: unknown };
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }
  if (body.action !== 'reset') {
    return NextResponse.json({ error: 'action نامعتبر است.' }, { status: 400 });
  }

  const admin = await prisma.user.findUnique({ where: { email: adminEmailFor(bound.domain) } });
  if (!admin) {
    return NextResponse.json({ error: 'حساب ادمین این سایت یافت نشد.' }, { status: 404 });
  }
  await prisma.user.update({
    where: { id: admin.id },
    data: { salt: ADMIN_SALT, passwordHash: ADMIN_HASH },
  });
  return NextResponse.json({ email: admin.email, isDefaultPassword: true });
}
