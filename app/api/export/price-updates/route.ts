import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { faJalaliLongDate } from '@/lib/format';
import { describeAdjust } from '@/lib/price-adjust';
import { listPriceChangeBatches } from '@/lib/price-updates';
import { stockListWorkbook } from '@/lib/xlsx-export';

/** Exports the batch price-change history as an .xlsx file. */
export async function GET() {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canAccessMenu(session, '/price-updates')) {
    return NextResponse.json({ error: 'دسترسی به این لیست را ندارید.' }, { status: 403 });
  }

  const batches = await listPriceChangeBatches();
  const rows = batches.flatMap((batch) =>
    batch.changes.map((change) => [
      batch.batchId,
      faJalaliLongDate(new Date(batch.createdAt)),
      batch.actorName,
      batch.targetName,
      describeAdjust(batch.adjustType as Parameters<typeof describeAdjust>[0], batch.adjustValue),
      change.productName,
      change.variantName ?? 'قیمت کالا',
      change.oldPrice,
      change.newPrice,
    ])
  );

  const buffer = await stockListWorkbook(
    'تغییر قیمت‌ها',
    [
      'شناسه دسته',
      'تاریخ',
      'کاربر',
      'هدف تغییر',
      'نوع تغییر',
      'کالا',
      'نوع کالا',
      'قیمت قبلی (تومان)',
      'قیمت جدید (تومان)',
    ],
    rows
  );
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="price-updates-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
