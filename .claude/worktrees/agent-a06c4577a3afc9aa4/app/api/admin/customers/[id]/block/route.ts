import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { setCustomerBlocked } from '@/lib/customers';

interface BlockBody {
  blocked?: unknown;
}

/**
 * Blocks or unblocks a customer account (مشتریان ← مسدود کردن). A blocked
 * customer is refused at sign-in with a 403 until an admin unblocks them.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/customers', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;

  let body: BlockBody;
  try {
    body = (await request.json()) as BlockBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  if (typeof body.blocked !== 'boolean') {
    return NextResponse.json({ error: 'وضعیت مسدودی باید true یا false باشد.' }, { status: 400 });
  }

  const updated = await setCustomerBlocked(id, body.blocked);
  if (!updated) {
    return NextResponse.json({ error: 'مشتری یافت نشد.' }, { status: 404 });
  }

  return NextResponse.json({ blocked: body.blocked });
}
