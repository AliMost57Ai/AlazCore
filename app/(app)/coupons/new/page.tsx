import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Stack } from '@mantine/core';
import CouponForm from '@/components/coupons/CouponForm';
import PageHeader from '@/components/layout/PageHeader';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listCategories } from '@/lib/categories';
import { listCustomers } from '@/lib/customers';
import { listProducts } from '@/lib/products';

export const metadata: Metadata = {
  title: 'کد تخفیف جدید',
};

/**
 * صفحه اختصاصی ساخت کد تخفیف — فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند
 * (قرارداد پنل)؛ همان فرم قبلی مودال روی صفحه است.
 */
export default async function NewCouponPage() {
  const session = await requireSession('/coupons/new');

  // The API enforces this too; the redirect just avoids a dead form for staff
  // whose role was not granted the add action.
  if (!canAccessMenu(session, '/coupons', 'add')) {
    redirect('/coupons');
  }

  const [customers, products, categories] = await Promise.all([
    listCustomers(),
    listProducts(),
    listCategories(),
  ]);

  return (
    <Stack gap="lg">
      <PageHeader title="کد تخفیف جدید" description="مشخصات و شرایط کد تخفیف را وارد کنید." />
      <Card>
        <CouponForm
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
    </Stack>
  );
}
