import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { buildLicenseSnapshot, resolveApiKey } from '@/lib/licensing';
import {
  checkDomainOpenCap,
  createDomainTicket,
  listTicketsForDomain,
  validateTicketInput,
} from '@/lib/tickets';

/**
 * API تیکتینگ مستأجر — سیستم تیکت مالک سایت ↔ پشتیبان کور، این بار از سمت
 * مالک: پنل فروشگاه با کلید API و دامنه خودش صدا می‌زند و تیکت‌های همان دامنه
 * را می‌بیند/می‌سازد/جواب می‌دهد. واژه‌نامه و قواعد نسخه مرجع: displayId،
 * نخوانده مشتق، سقف ۵ تیکت باز دامنه و قفل تیکت بسته.
 *
 * احراز: هدر x-core-key (مقایسه timing-safe) + دامنه در x-core-domain یا
 * query/body. دامنه باید فعال (ok) باشد — سایت غیرفعال حق تیکت زدن ندارد.
 */

interface DomainRow {
  id: string;
  ownerName: string;
}

/** مقایسه کلید API بدون نشت زمانی — طول نابرابر هم امن رد می‌شود. */
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

function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  return request
    .json()
    .then((value) => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {}))
    .catch(() => ({}));
}

/** GET /api/tenant/tickets?domain=… — تیکت‌های این دامنه با نخواندهٔ مشتق سمت مالک. */
export async function GET(request: NextRequest) {
  const guard = await authorize(request, null);
  if ('error' in guard) {
    return guard.error;
  }

  const tickets = await listTicketsForDomain(guard.domainRow.id);
  return NextResponse.json({ tickets }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST /api/tenant/tickets — ثبت تیکت جدید از سمت مالک سایت. */
export async function POST(request: NextRequest) {
  const body = await readBody(request);
  const guard = await authorize(request, body.domain);
  if ('error' in guard) {
    return guard.error;
  }

  const input = validateTicketInput(body.subject, body.body);
  if ('error' in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const capError = await checkDomainOpenCap(guard.domainRow.id);
  if (capError) {
    return NextResponse.json({ error: capError }, { status: 400 });
  }

  const requesterName = guard.domainRow.ownerName || 'مالک سایت';
  const ticket = await createDomainTicket({
    domainId: guard.domainRow.id,
    requesterName,
    subject: input.subject,
    body: input.body,
  });
  if (!ticket.ok) {
    return NextResponse.json({ error: ticket.error }, { status: 500 });
  }
  return NextResponse.json({ id: ticket.value.id }, { status: 201 });
}
