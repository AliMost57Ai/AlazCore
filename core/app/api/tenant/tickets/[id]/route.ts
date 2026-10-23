import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { buildLicenseSnapshot, resolveApiKey } from '@/lib/licensing';
import { addTicketMessage, getTicketFull, markTicketRead } from '@/lib/tickets';

/**
 * API مستأجر برای یک تیکت — مالک فقط روی تیکت‌های دامنه خودش می‌خواند/پاسخ
 * می‌دهد. GET بازکردن رشته را برای مالک خوانده می‌کند (بج نخوانده ویو او پاک
 * می‌شود). تیکت بسته پیام نمی‌پذیرد — تغییر وضعیت هم فقط از سمت پشتیبان کور
 * است (بازگشایی/بستن از /panel/tickets).
 */

interface DomainRow {
  id: string;
  ownerName: string;
}

function keysMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

async function authorize(
  request: NextRequest,
  bodyDomain: unknown
): Promise<{ domainRow: DomainRow } | { error: NextResponse }> {
  const expected = await resolveApiKey();
  if (!expected) {
    return { error: NextResponse.json({ error: 'سرویس پیکربندی نشده است.' }, { status: 503 }) };
  }
  const provided = request.headers.get('x-core-key');
  if (!provided || !keysMatch(provided, expected)) {
    return { error: NextResponse.json({ error: 'کلید API نامعتبر است.' }, { status: 401 }) };
  }

  const domainRaw =
    (typeof bodyDomain === 'string' && bodyDomain) ||
    request.headers.get('x-core-domain') ||
    request.nextUrl.searchParams.get('domain') ||
    '';
  const domain = domainRaw.trim().toLowerCase();
  if (!domain) {
    return { error: NextResponse.json({ error: 'دامنه ارسال نشده است.' }, { status: 400 }) };
  }

  const license = await buildLicenseSnapshot(domain);
  if (!license.ok) {
    return {
      error: NextResponse.json(
        { error: `دامنه مجاز به استفاده از پشتیبانی نیست (${license.status}).` },
        { status: 403 }
      ),
    };
  }

  const domainRow = await prisma.domain.findUnique({
    where: { domain },
    select: { id: true, ownerName: true },
  });
  if (!domainRow) {
    return { error: NextResponse.json({ error: 'دامنه یافت نشد.' }, { status: 404 }) };
  }
  return { domainRow };
}

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** GET /api/tenant/tickets/[id]?domain=… — یک تیکت با گفتگوها (مالکیت دامنه). */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await authorize(request, null);
  if ('error' in guard) {
    return guard.error;
  }

  const { id } = await ctx.params;
  const ticket = await getTicketFull(id, guard.domainRow.id);
  if (!ticket) {
    return NextResponse.json({ error: 'تیکت یافت نشد.' }, { status: 404 });
  }

  await markTicketRead(id, 'tenant');
  return NextResponse.json({ ticket }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST /api/tenant/tickets/[id] — پاسخ مالک؛ وضعیت خودکار به open «در انتظار پاسخ» می‌رود. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const body = await readBody(request);
  const guard = await authorize(request, body.domain);
  if ('error' in guard) {
    return guard.error;
  }

  const { id } = await ctx.params;

  // مالکیت اول — تیکت غریبه ۴۰۴ می‌خورد.
  const owned = await prisma.ticket.findUnique({
    where: { id },
    select: { domainId: true },
  });
  if (!owned || owned.domainId !== guard.domainRow.id) {
    return NextResponse.json({ error: 'تیکت یافت نشد.' }, { status: 404 });
  }

  const message = typeof body.body === 'string' ? body.body : '';
  if (!message.trim()) {
    return NextResponse.json({ error: 'متن پیام لازم است.' }, { status: 400 });
  }

  const result = await addTicketMessage(id, { side: 'tenant', name: guard.domainRow.ownerName || 'مالک سایت' }, message);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
