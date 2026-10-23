import { NextResponse } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { listTicketsForStaff } from '@/lib/customer-tickets';

/**
 * تیکتینگ مشتری↔مالک — سمت مالک/پرسنل فروشگاه (داشبورد). تیکت را مشتری/مهمان
 * می‌سازد؛ اینجا پشتیبان می‌بیند، پاسخ می‌دهد، وضعیت را عوض می‌کند و می‌بندد.
 *
 * GET — همه تیکت‌ها به‌صورت DTO با نخواندهٔ مشتق سمت پشتیبان؛ فیلتر/جست‌وجو
 * سمت کلاینت (قرارداد load-all ریپو).
 */
export async function GET() {
  const session = await requireApiMenu('/customer-support', 'view');
  if (session instanceof NextResponse) {
    return session;
  }

  const tickets = await listTicketsForStaff();
  return NextResponse.json({ tickets });
}
