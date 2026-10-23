import { NextResponse } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { listBrands } from '@/lib/brands';
import { brandsWorkbook } from '@/lib/xlsx-export';

/** GET /api/export/brands — خروجی اکسل لیست برندها (قاعده هر لیست پنل). */
export async function GET() {
  const session = await requireApiMenu('/brands');
  if (session instanceof NextResponse) {
    return session;
  }

  const buffer = await brandsWorkbook(await listBrands());
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="brands-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
