import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireApiMenu } from '@/lib/auth';

interface PlanBody {
  name?: unknown;
  description?: unknown;
  menus?: unknown;
  limits?: unknown;
  isActive?: unknown;
  durationDays?: unknown;
  priceMonthly?: unknown;
}

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value.trim() : fallback;

/** PATCH /api/plans/[id] — ویرایش پلن (فقط مدیر کل). */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/plans', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'پلن یافت نشد.' }, { status: 404 });
  }

  let body: PlanBody;
  try {
    body = (await request.json()) as PlanBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const name = str(body.name, existing.name);
  if (!name) {
    return NextResponse.json({ error: 'نام پلن الزامی است.' }, { status: 400 });
  }

  const plan = await prisma.plan.update({
    where: { id },
    data: {
      name,
      description: str(body.description, existing.description),
      menus: body.menus === undefined ? existing.menus : JSON.stringify(
        Array.isArray(body.menus) ? body.menus.map(String) : []
      ),
      limits: body.limits === undefined ? existing.limits : JSON.stringify(
        body.limits && typeof body.limits === 'object' && !Array.isArray(body.limits)
          ? body.limits
          : {}
      ),
      isActive: body.isActive === undefined ? existing.isActive : body.isActive !== false,
      durationDays:
        typeof body.durationDays === 'number' && body.durationDays > 0
          ? Math.floor(body.durationDays)
          : null,
      priceMonthly:
        typeof body.priceMonthly === 'number' && body.priceMonthly >= 0
          ? Math.floor(body.priceMonthly)
          : existing.priceMonthly,
    },
  });
  return NextResponse.json({ ok: true, id: plan.id });
}

/** DELETE /api/plans/[id] — حذف پلن؛ دامین‌های متصل با SetNull رها می‌شوند. */
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/plans', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'پلن یافت نشد.' }, { status: 404 });
  }

  await prisma.plan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
