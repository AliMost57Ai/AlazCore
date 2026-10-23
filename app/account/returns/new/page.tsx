import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import ReturnRequestForm from '@/components/account/ReturnRequestForm';
import { requireSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { faJalaliLongDate } from '@/lib/format';
import { orderReturnableLines } from '@/lib/product-returns';
import { getOrdersReturnState } from '@/lib/return-eligibility';

export const metadata: Metadata = {
  title: 'درخواست مرجوعی',
};

export const dynamic = 'force-dynamic';

/**
 * فرم درخواست مرجوعی یک سفارش تحویل‌شده — ?order=ORD-xxxxx. اهلیت (مالکیت،
 * تحویل‌شده بودن، ویندوی باز و نداشتن درخواست فعال) سمت سرور چک می‌شود و
 * اقلام با سقفِ قابل مرجوع به فرم داده می‌شود.
 */
export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const session = await requireSession('/account/returns');
  const { order: orderDisplayId } = await searchParams;
  if (!orderDisplayId) {
    redirect('/account/orders');
  }

  const order = await prisma.order.findUnique({ where: { displayId: orderDisplayId } });
  if (!order || order.userId !== session.sub || order.status !== 'delivered') {
    redirect('/account/orders');
  }

  const state = (await getOrdersReturnState([order])).get(order.id);
  if (!state?.canRequest) {
    redirect('/account/orders');
  }

  const { lines, paidGoodsTotal, committedAmount } = await orderReturnableLines(order.id);

  return (
    <Stack gap="md">
      <ReturnRequestForm
        orderId={order.id}
        orderDisplayId={order.displayId}
        lines={lines}
        paidGoodsTotal={paidGoodsTotal}
        committedAmount={committedAmount}
        windowDays={state.windowDays}
        windowEndsLabel={state.windowEndsAt ? faJalaliLongDate(state.windowEndsAt) : '—'}
      />
    </Stack>
  );
}
