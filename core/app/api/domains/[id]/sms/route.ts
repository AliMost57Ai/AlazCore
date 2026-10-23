import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireApiMenu } from '@/lib/auth';
import { isSmsPanelInUse } from '@/lib/usage';
import { SMS_PROVIDERS } from '@/lib/constants';

interface BindingBody {
  provider?: unknown;
  label?: unknown;
  isActive?: unknown;
  notes?: unknown;
}

const providerIds = new Set(SMS_PROVIDERS.map((p) => p.id));

/** POST /api/domains/[id]/sms — تخصیص/به‌روزرسانی پنل پیامکی به دامین (مدیر کل). */
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

  const provider = typeof body.provider === 'string' ? body.provider.trim() : '';
  if (!providerIds.has(provider)) {
    return NextResponse.json({ error: 'پنل پیامکی انتخاب‌شده در کاتالوگ نیست.' }, { status: 400 });
  }
  const entry = SMS_PROVIDERS.find((p) => p.id === provider);

  const binding = await prisma.smsBinding.upsert({
    where: { domainId_provider: { domainId: id, provider } },
    update: {
      isActive: body.isActive !== false,
      label: typeof body.label === 'string' && body.label.trim() ? body.label.trim() : entry?.label ?? provider,
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    },
    create: {
      domainId: id,
      provider,
      label: typeof body.label === 'string' && body.label.trim() ? body.label.trim() : entry?.label ?? provider,
      isActive: body.isActive !== false,
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    },
  });
  return NextResponse.json({ id: binding.id });
}

/** DELETE /api/domains/[id]/sms?provider=smsir — حذف تخصیص پنل پیامکی. */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/domains', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const provider = request.nextUrl.searchParams.get('provider') ?? '';
  if (!provider) {
    return NextResponse.json({ error: 'شناسه پنل پیامکی لازم است.' }, { status: 400 });
  }

  // قاعده «در حال استفاده» برای پنل پیامکی — «نمی‌دانیم» هم حذف نکن.
  const domain = await prisma.domain.findUnique({ where: { id }, select: { domain: true } });
  const inUse = await isSmsPanelInUse(domain?.domain ?? '', provider);
  if (inUse !== false) {
    return NextResponse.json(
      { error: `پنل پیامکی «${provider}» در حال استفاده است و قابل حذف از تخصیص نیست.` },
      { status: 409 }
    );
  }

  await prisma.smsBinding.deleteMany({ where: { domainId: id, provider } });
  return NextResponse.json({ ok: true });
}

/** GET /api/domains/[id]/sms — پنل‌های پیامکی این دامین (هر دو نقش). */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/domains');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const bindings = await prisma.smsBinding.findMany({ where: { domainId: id } });
  return NextResponse.json({ bindings });
}
