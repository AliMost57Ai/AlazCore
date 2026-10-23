import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiMenu } from '@/lib/auth';

/** GET /api/catalog/gateways — کاتالوگ درگاه‌ها (هر دو kind). */
export async function GET() {
  const session = await requireApiMenu('/panel/gateways');
  if (session instanceof Response) {
    return session;
  }
  const gateways = await prisma.coreGateway.findMany({ orderBy: [{ kind: 'asc' }, { id: 'asc' }] });
  return NextResponse.json({ gateways });
}
