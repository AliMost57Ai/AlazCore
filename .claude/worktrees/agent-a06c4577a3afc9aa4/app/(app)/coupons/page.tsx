import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@mantine/core';
import CouponsTable from '@/components/coupons/CouponsTable';
import PageHeader from '@/components/layout/PageHeader';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listCategories } from '@/lib/categories';
import { listCoupons } from '@/lib/coupons';
import { listCustomers } from '@/lib/customers';
import { faNumber } from '@/lib/format';
import { listProducts } from '@/lib/products';

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

  const [coupons, customers, products, categories] = await Promise.all([
    listCoupons(),
    listCustomers(),
    listProducts(),
    listCategories(),
  ]);
  const activeCount = coupons.filter((coupon) => coupon.isActive).length;
  const canAdd = canAccessMenu(session, '/coupons', 'add');
  const canEdit = canAccessMenu(session, '/coupons', 'edit');

  return (
    <>
      <PageHeader
        title="کد تخفیف‌ها"
        description={`${faNumber(coupons.length)} کد تخفیف — ${faNumber(activeCount)} فعال`}
      />
      <Card>
        <CouponsTable
          coupons={coupons}
          canAdd={canAdd}
          canEdit={canEdit}
          customers={customers.map((customer) => ({
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
          }))}
          products={products.map((product) => ({ id: product.id, name: product.name }))}
          categories={categories.flatMap((group) =>
            [
              { id: group.id, label: group.name },
              ...group.children.map((child) => ({
                id: child.id,
                label: `${group.name} › ${child.name}`,
              })),
            ].map((option) => ({ id: option.id, label: option.label }))
          )}
        />
      </Card>
    </>
  );
}
