import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@mantine/core';
import CouponsTable from '@/components/coupons/CouponsTable';
import PageHeader from '@/components/layout/PageHeader';
import ListActions from '@/components/ui/panel/ListActions';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listCoupons } from '@/lib/coupons';
import { enNumber } from '@/lib/format';

export const metadata: Metadata = {
  title: 'کد تخفیف‌',
};

/**
 * The admin coupon manager: discount codes with percent/fixed values, expiry,
 * usage caps, and optional assignment to one customer and/or one product.
 * Customers apply these at checkout; the discount is stored on the order and
 * the use (one per customer) is only counted once the payment goes through.
 */
export default async function CouponsPage() {
  const session = await requireSession('/coupons');

  // The API enforces this too; the redirect just avoids dead controls for staff
  // whose role was not granted this menu.
  if (!canAccessMenu(session, '/coupons')) {
    redirect('/dashboard');
  }

  const coupons = await listCoupons();
  const activeCount = coupons.filter((coupon) => coupon.isActive).length;
  const canAdd = canAccessMenu(session, '/coupons', 'add');
  const canEdit = canAccessMenu(session, '/coupons', 'edit');

  return (
    <>
      <PageHeader
        title="کد تخفیف‌ها"
        description={`${enNumber(coupons.length)} کد تخفیف — ${enNumber(activeCount)} فعال`}
        actions={<ListActions exportHref="/api/export/coupons" />}
      />
      <Card>
        <CouponsTable coupons={coupons} canAdd={canAdd} canEdit={canEdit} />
      </Card>
    </>
  );
}
