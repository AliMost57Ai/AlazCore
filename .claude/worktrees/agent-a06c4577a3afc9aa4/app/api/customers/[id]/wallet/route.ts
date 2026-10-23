import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import prisma from '@/lib/db';
import { creditWallet, debitWallet } from '@/lib/wallet';

interface WalletAdjustBody {
  direction?: unknown;
  amount?: unknown;
  reason?: unknown;
}

/**
 * Admin wallet adjustment: credit (+) or debit (−) a customer's wallet with a
 * mandatory reason. Every adjustment lands in the wallet ledger as an
 * 'admin_adjust' row, and a debit that would overdraw the wallet is rejected.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/customers', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;

  let body: WalletAdjustBody;
  try {
    body = (await request.json()) as WalletAdjustBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const direction = body.direction === '-' || body.direction === 'debit' ? '-' : '+';
  const amount = Number(body.amount);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!Number.isInteger(amount) || amount < 1 || amount > 2_000_000_000) {
    return NextResponse.json({ error: 'مبلغ باید عددی مثبت باشد.' }, { status: 400 });
  }
  if (reason.length < 3) {
    return NextResponse.json(
      { error: 'دلیل تعدیل را وارد کنید (حداقل ۳ نویسه).' },
      { status: 400 }
    );
  }

  const customer = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!customer) {
    return NextResponse.json({ error: 'مشتری یافت نشد.' }, { status: 404 });
  }

  const balance = await prisma.$transaction(async (tx) => {
    if (direction === '+') {
      await creditWallet(tx, {
        userId: customer.id,
        amount,
        type: 'admin_adjust',
        reason: `${reason} — توسط ${session.name}`,
      });
    } else {
      const debited = await debitWallet(tx, {
        userId: customer.id,
        amount,
        type: 'admin_adjust',
        reason: `${reason} — توسط ${session.name}`,
      });
      if (!debited) {
        return null;
      }
    }
    const user = await tx.user.findUnique({
      where: { id: customer.id },
      select: { walletBalance: true },
    });
    return user?.walletBalance ?? 0;
  });

  if (balance === null) {
    return NextResponse.json(
      { error: 'موجودی کیف پول مشتری برای این کسر کافی نیست.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ balance });
}
