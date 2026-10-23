import { NextResponse, type NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import { logoMime, resolveCatalogLogoFile } from '@/lib/catalog-assets';
import prisma from '@/lib/db';

/**
 * GET /api/catalog/logo/[kind]/[id] — سرو لوگوی کاتالوگ. تصویر برندِ درگاه
 * است و حساسیت ندارد؛ مسیر از DB خوانده می‌شود و فقط داخل uploads مجاز است.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await ctx.params;
  if (kind !== 'gateways' && kind !== 'sms') {
    return NextResponse.json({ error: 'نوع نامعتبر.' }, { status: 400 });
  }

  const row =
    kind === 'gateways'
      ? await prisma.coreGateway.findUnique({ where: { id }, select: { logoPath: true } })
      : await prisma.coreSmsPanel.findUnique({ where: { id }, select: { logoPath: true } });

  if (!row?.logoPath) {
    return NextResponse.json({ error: 'لوگویی ثبت نشده است.' }, { status: 404 });
  }

  const file = resolveCatalogLogoFile(row.logoPath);
  if (!file) {
    return NextResponse.json({ error: 'مسیر نامعتبر است.' }, { status: 400 });
  }

  try {
    const bytes = await readFile(file);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': logoMime(file),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'فایل لوگو یافت نشد.' }, { status: 404 });
  }
}
