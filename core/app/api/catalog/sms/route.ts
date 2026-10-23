import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiMenu } from '@/lib/auth';

/** GET /api/catalog/sms — کاتالوگ پنل‌های پیامکی. */
export async function GET() {
  const session = await requireApiMenu('/panel/sms-panels');
  if (session instanceof Response) {
    return session;
  }
  const panels = await prisma.coreSmsPanel.findMany({ orderBy: { id: 'asc' } });
  return NextResponse.json({ panels });
}
