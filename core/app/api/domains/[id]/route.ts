import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/auth';
import prisma from '@/lib/db';
import { ensureProvisioned } from '@/lib/provision';
import { guardDomainOversell, toDomainInput, validateDomainInput, type DomainBody } from '../route';

/** GET /api/domains/[id] — جزئیات کامل یک دامین با تاریخچه پلن. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/domains');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const domain = await prisma.domain.findUnique({
    where: { id },
    include: {
      plan: true,
      template: true,
      gateways: true,
      smsPanels: true,
      assignments: { orderBy: { createdAt: 'desc' }, include: { plan: true } },
      tickets: { orderBy: { updatedAt: 'desc' }, take: 10 },
    },
  });
  if (!domain) {
    return NextResponse.json({ error: 'دامنه یافت نشد.' }, { status: 404 });
  }
  return NextResponse.json({ domain });
}

/** PATCH /api/domains/[id] — ویرایش دامین (فقط مدیر کل). */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/domains', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
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

  const existing = await prisma.domain.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'دامنه یافت نشد.' }, { status: 404 });
  }

  // بدون فیلدهای خالی‌فروشی در payload، مقادیر موجود دست‌نخورده می‌مانند —
  // کارشناس بدون مجوز فرم را بدون این فیلدها می‌فرستد.
  const oversellTouches = body.oversellAllowed !== undefined || body.oversellMax !== undefined;
  const { oversellAllowed, oversellMax, inPersonDelivery: _ignored, ...baseInput } =
    toDomainInput(body);
  // تحویل حضوری هم فقط وقتی در payload بیاید اعمال می‌شود.
  const input = {
    ...baseInput,
    ...(oversellTouches ? { oversellAllowed, oversellMax } : {}),
    ...(body.inPersonDelivery !== undefined ? { inPersonDelivery: body.inPersonDelivery === true } : {}),
  };
  const invalid = validateDomainInput(input);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const duplicate = await prisma.domain.findFirst({
    where: { domain: input.domain, id: { not: id } },
  });
  if (duplicate) {
    return NextResponse.json({ error: 'این دامنه قبلاً ثبت شده است.' }, { status: 400 });
  }

  // تغییر پلن = ردیف جدید در تاریخچه تخصیص.
  const planChanged = input.planId !== existing.planId;
  const now = new Date();
  if (planChanged && existing.planId) {
    await prisma.planAssignment.updateMany({
      where: { domainId: id, endsAt: null },
      data: { endsAt: now },
    });
  }

  const domain = await prisma.domain.update({
    where: { id },
    data: {
      ...input,
      assignments:
        planChanged && input.planId
          ? { create: { planId: input.planId, startsAt: now, endsAt: input.planExpiresAt } }
          : undefined,
    },
  });
  return NextResponse.json({ ok: true, id: domain.id });
}

/** POST /api/domains/[id]/provision? — تلاش مجدد provision (action:'reprovision'). */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/domains', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain) {
    return NextResponse.json({ error: 'دامنه یافت نشد.' }, { status: 404 });
  }

  const result = await ensureProvisioned(domain.domain, {
    dbName: domain.dbName,
    dbStatus: domain.dbStatus,
  });
  await prisma.domain.update({
    where: { id },
    data: { dbName: result.dbName, dbStatus: result.status },
  });
  return NextResponse.json({ dbName: result.dbName, dbStatus: result.status });
}

/** DELETE /api/domains/[id] — حذف دامین (فقط مدیر کل). */
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/domains', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const existing = await prisma.domain.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'دامنه یافت نشد.' }, { status: 404 });
  }

  await prisma.domain.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
