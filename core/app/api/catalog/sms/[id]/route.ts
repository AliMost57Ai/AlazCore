import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireApiMenu } from '@/lib/auth';
import { saveCatalogLogo } from '@/lib/catalog-assets';

/**
 * PATCH /api/catalog/sms/[id] — ویرایش نام و آپلود لوگو (FormData) یا JSON
 * با isActive. غیرفعال‌سازی فقط از تخصیصِ جدید جلوگیری می‌کند.
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/sms-panels', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const existing = await prisma.coreSmsPanel.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'پنل پیامکی یافت نشد.' }, { status: 404 });
  }

  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    let body: { isActive?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
    }
    const panel = await prisma.coreSmsPanel.update({
      where: { id },
      data: { isActive: body.isActive !== false },
    });
    return NextResponse.json({ ok: true, isActive: panel.isActive });
  }

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const data: { label?: string; logoPath?: string } = {};

    const label = form.get('label');
    if (typeof label === 'string' && label.trim().length >= 2 && label.trim().length <= 64) {
      data.label = label.trim();
    }

    const logo = form.get('logo');
    if (logo && typeof logo === 'object' && 'arrayBuffer' in logo) {
      const bytes = new Uint8Array(await (logo as File).arrayBuffer());
      const saved = await saveCatalogLogo('sms', id, bytes);
      if (!saved) {
        return NextResponse.json(
          { error: 'لوگو نامعتبر است — فقط png/jpg/webp/svg تا ۲ مگابایت.' },
          { status: 400 }
        );
      }
      data.logoPath = saved;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'تغییری ارسال نشده است.' }, { status: 400 });
    }

    const panel = await prisma.coreSmsPanel.update({ where: { id }, data });
    return NextResponse.json({ ok: true, label: panel.label, logoPath: panel.logoPath });
  }

  return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
}
