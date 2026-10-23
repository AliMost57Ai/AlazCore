import { NextResponse, type NextRequest } from 'next/server';
import { canOversellDomain, requireApiMenu } from '@/lib/auth';
import prisma from '@/lib/db';
import { provisionSiteDb } from '@/lib/provision';

const DOMAIN_PATTERN =
  /^(\*\.)?[a-z0-9\u0600-\u06FF]([\w\u0600-\u06FF-]*[\w\u0600-\u06FF])?(\.[a-z0-9\u0600-\u06FF]([\w\u0600-\u06FF-]*[\w\u0600-\u06FF])?)+$/;

export interface DomainBody {
  domain?: unknown;
  ownerName?: unknown;
  ownerPhone?: unknown;
  ownerEmail?: unknown;
  techName?: unknown;
  techPhone?: unknown;
  techEmail?: unknown;
  planId?: unknown;
  planExpiresAt?: unknown;
  isActive?: unknown;
  status?: unknown;
  notes?: unknown;
  templateId?: unknown;
  commissionPercent?: unknown;
  oversellAllowed?: unknown;
  oversellMax?: unknown;
  inPersonDelivery?: unknown;
}

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value.trim() : fallback;

export function toDomainInput(body: DomainBody) {
  return {
    domain: str(body.domain)
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split(/[/:?#]/)[0],
    ownerName: str(body.ownerName),
    ownerPhone: str(body.ownerPhone),
    ownerEmail: str(body.ownerEmail),
    techName: str(body.techName),
    techPhone: str(body.techPhone),
    techEmail: str(body.techEmail),
    planId: typeof body.planId === 'string' && body.planId ? body.planId : null,
    planExpiresAt:
      typeof body.planExpiresAt === 'string' && body.planExpiresAt
        ? new Date(body.planExpiresAt)
        : null,
    isActive: body.isActive === true,
    status: body.status === 'suspended' ? 'suspended' : 'active',
    notes: str(body.notes),
    templateId: typeof body.templateId === 'string' && body.templateId ? body.templateId : null,
    commissionPercent:
      typeof body.commissionPercent === 'number' &&
      Number.isFinite(body.commissionPercent) &&
      body.commissionPercent >= 0 &&
      body.commissionPercent <= 100
        ? Math.floor(body.commissionPercent)
        : 0,
    oversellAllowed: body.oversellAllowed === true,
    oversellMax:
      body.oversellAllowed === true &&
      typeof body.oversellMax === 'number' &&
      Number.isFinite(body.oversellMax) &&
      body.oversellMax >= 0
        ? Math.floor(body.oversellMax)
        : 0,
    inPersonDelivery: body.inPersonDelivery === true,
  };
}

export function validateDomainInput(input: { domain: string; ownerName: string }): string | null {
  if (!input.domain) {
    return 'دامنه الزامی است.';
  }
  if (!DOMAIN_PATTERN.test(input.domain)) {
    return 'قالب دامنه معتبر نیست (مثال: joghd.ir).';
  }
  if (!input.ownerName) {
    return 'نام مالک سایت الزامی است.';
  }
  return null;
}

/**
 * گیت مجوز خالی‌فروشی دامنه — زنجیره تسک: فقط کارشناسی که مدیر کل به او
 * قابلیت 'cap:domain-oversell' داده (یا مدیر کل خودش) می‌تواند این
 * امکان را برای یک سایت فعال/غیرفعال کند و سقفش را تعیین کند. payload
 * بدون این فیلدها = بدون تغییر (در ویرایش مقادیر موجود حفظ می‌شوند).
 */
export async function guardDomainOversell(
  body: DomainBody,
  session: Awaited<ReturnType<typeof requireApiMenu>>
): Promise<NextResponse | null> {
  if (session instanceof Response) {
    return null;
  }
  const touches = body.oversellAllowed !== undefined || body.oversellMax !== undefined;
  if (touches && !(await canOversellDomain(session))) {
    return NextResponse.json(
      {
        error:
          'برای فعال‌سازی خالی‌فروشی این دامنه دسترسی ندارید — این مجوز باید از سوی مدیر سامانه واگذار شود.',
      },
      { status: 403 }
    );
  }
  return null;
}

/** GET /api/domains — فهرست دامین‌ها با پلن/تم/بایندها. */
export async function GET() {
  const session = await requireApiMenu('/panel/domains');
  if (session instanceof Response) {
    return session;
  }

  const domains = await prisma.domain.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      plan: { select: { id: true, name: true } },
      template: { select: { id: true, name: true, key: true } },
      gateways: { select: { id: true, gateway: true, kind: true, isActive: true } },
      smsPanels: { select: { id: true, provider: true, isActive: true } },
      _count: { select: { tickets: true } },
    },
  });
  return NextResponse.json({ domains });
}

/** POST /api/domains — تعریف دامنه جدید (فقط مدیر کل). */
export async function POST(request: NextRequest) {
  const session = await requireApiMenu('/panel/domains', 'add');
  if (session instanceof Response) {
    return session;
  }

  let body: DomainBody;
  try {
    body = (await request.json()) as DomainBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const oversellDenied = await guardDomainOversell(body, session);
  if (oversellDenied) {
    return oversellDenied;
  }

  const input = toDomainInput(body);
  const invalid = validateDomainInput(input);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const duplicate = await prisma.domain.findUnique({ where: { domain: input.domain } });
  if (duplicate) {
    return NextResponse.json({ error: 'این دامنه قبلاً ثبت شده است.' }, { status: 400 });
  }

  const domain = await prisma.domain.create({
    data: {
      ...input,
      // تخصیص پلن همراه با ثبت در تاریخچه PlanAssignment
      assignments: input.planId
        ? { create: { planId: input.planId, endsAt: input.planExpiresAt } }
        : undefined,
    },
  });

  // پوشه + دیتابیس اختصاصی سایت — نامش در همان ثبت (dbName) نمایش داده
  // می‌شود؛ شکست provision دامنه را pending می‌گذارد و ثبت را نمی‌شکند.
  const provision = await provisionSiteDb(domain.domain);
  await prisma.domain.update({
    where: { id: domain.id },
    data: { dbName: provision.dbName, dbStatus: provision.status },
  });

  return NextResponse.json(
    { id: domain.id, dbName: provision.dbName, dbStatus: provision.status },
    { status: 201 }
  );
}
