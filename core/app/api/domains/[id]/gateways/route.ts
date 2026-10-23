import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireApiMenu } from '@/lib/auth';
import { isGatewayInUse } from '@/lib/usage';
import { GATEWAY_CATALOG } from '@/lib/constants';

interface BindingBody {
  gateway?: unknown;
  kind?: unknown;
  label?: unknown;
  isActive?: unknown;
  notes?: unknown;
}

const catalogIds = new Set(GATEWAY_CATALOG.map((g) => g.id));

/** POST /api/domains/[id]/gateways — تخصیص/به‌روزرسانی درگاه به دامین (مدیر کل).
 *  مشخص می‌کند کدام درگاه (پرداخت یا اقساطی) برای کدام دامنه معتبر و فعال است. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/domains', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain) {
    return NextResponse.json({ error: 'دامنه یافت نشد.' }, { status: 404 });
  }

  let body: BindingBody;
  try {
    body = (await request.json()) as BindingBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const gateway = typeof body.gateway === 'string' ? body.gateway.trim() : '';
  if (!catalogIds.has(gateway)) {
    return NextResponse.json({ error: 'درگاه انتخاب‌شده در کاتالوگ نیست.' }, { status: 400 });
  }
  const entry = GATEWAY_CATALOG.find((g) => g.id === gateway);

  const binding = await prisma.gatewayBinding.upsert({
    where: { domainId_gateway: { domainId: id, gateway } },
    update: {
      isActive: body.isActive !== false,
      kind: entry?.kind ?? 'ipg',
      label: typeof body.label === 'string' && body.label.trim() ? body.label.trim() : entry?.label ?? gateway,
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    },
    create: {
      domainId: id,
      gateway,
      kind: entry?.kind ?? 'ipg',
      label: typeof body.label === 'string' && body.label.trim() ? body.label.trim() : entry?.label ?? gateway,
      isActive: body.isActive !== false,
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    },
  });
  return NextResponse.json({ id: binding.id });
}

/** DELETE /api/domains/[id]/gateways?gateway=zarinpal — حذف تخصیص درگاه. */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/domains', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const gateway = request.nextUrl.searchParams.get('gateway') ?? '';
  if (!gateway) {
    return NextResponse.json({ error: 'شناسه درگاه لازم است.' }, { status: 400 });
  }

  // قاعده «در حال استفاده»: اگر مالک برای این درگاه تنظیمات وارد کرده یا
  // تراکنش از آن ثبت شده، کارشناس نمی‌تواند تخصیصش را حذف کند.
  // «نمی‌دانیم» (دیتابیس سایت در دسترس نیست) هم امن است: حذف نکن.
  const domain = await prisma.domain.findUnique({ where: { id }, select: { domain: true } });
  const inUse = await isGatewayInUse(domain?.domain ?? '', gateway);
  if (inUse !== false) {
    return NextResponse.json(
      {
        error:
          inUse === true
            ? `درگاه «${gateway}» در حال استفاده است (تنظیمات/تراکنش ثبت‌شده) و قابل حذف از تخصیص نیست.`
            : `وضعیت استفاده از درگاه «${gateway}» قابل بررسی نیست — حذف انجام نشد.`,
      },
      { status: 409 }
    );
  }

  await prisma.gatewayBinding.deleteMany({ where: { domainId: id, gateway } });
  return NextResponse.json({ ok: true });
}

/** GET /api/domains/[id]/gateways — درگاه‌های این دامین (هر دو نقش). */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/domains');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const bindings = await prisma.gatewayBinding.findMany({ where: { domainId: id } });
  return NextResponse.json({ bindings });
}
