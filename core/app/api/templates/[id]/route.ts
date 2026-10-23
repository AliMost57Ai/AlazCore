import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireApiMenu } from '@/lib/auth';

interface TemplateBody {
  name?: unknown;
  description?: unknown;
  isActive?: unknown;
  isDefault?: unknown;
}

/** PATCH /api/templates/[id] — ویرایش تم، فعال/غیرفعال، پیش‌فرض کردن (مدیر کل).
 *  پیش‌فرض بودن یکتاست: تیک isDefault روی بقیه برداشته می‌شود. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/templates', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const existing = await prisma.template.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'تم یافت نشد.' }, { status: 404 });
  }

  let body: TemplateBody;
  try {
    body = (await request.json()) as TemplateBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  // غیرفعال‌کردن تمِ پیش‌فرض ممکن نیست — سایت‌های بدون تمِ اختصاصی به آن برمی‌گردند.
  const nextActive = body.isActive === undefined ? existing.isActive : body.isActive !== false;
  const nextDefault = body.isDefault === undefined ? existing.isDefault : body.isDefault === true;
  if (!nextActive && (existing.isDefault || nextDefault)) {
    return NextResponse.json(
      { error: 'تم پیش‌فرض را نمی‌توان غیرفعال کرد؛ ابتدا تم دیگری را پیش‌فرض کنید.' },
      { status: 400 }
    );
  }

  if (body.isDefault === true && !existing.isDefault) {
    await prisma.template.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }

  const template = await prisma.template.update({
    where: { id },
    data: {
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.name,
      description:
        typeof body.description === 'string' ? body.description.trim() : existing.description,
      isActive: nextActive,
      isDefault: nextDefault,
    },
  });
  return NextResponse.json({ ok: true, id: template.id });
}

/** DELETE /api/templates/[id] — حذف تم (دامنین‌های متصل به null برمی‌گردند). */
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/templates', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const existing = await prisma.template.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'تم یافت نشد.' }, { status: 404 });
  }
  if (existing.isDefault) {
    return NextResponse.json(
      { error: 'تم پیش‌فرض قابل حذف نیست؛ ابتدا پیش‌فرض را عوض کنید.' },
      { status: 400 }
    );
  }

  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
