import { NextResponse } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { listFaqEntries } from '@/lib/faq';
import { faqWorkbook } from '@/lib/xlsx-export';

/** GET /api/export/faq — خروجی اکسل سوالات متداول (قاعده هر لیست پنل). */
export async function GET() {
  const session = await requireApiMenu('/settings/faq');
  if (session instanceof NextResponse) {
    return session;
  }

  const buffer = await faqWorkbook(await listFaqEntries());
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="faq-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
