import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Card, Stack } from '@mantine/core';
import CouponForm from '@/components/coupons/CouponForm';
import PageHeader from '@/components/layout/PageHeader';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listCategories } from '@/lib/categories';
import { listCoupons } from '@/lib/coupons';
import { listCustomers } from '@/lib/customers';
import { listProducts } from '@/lib/products';

export const metadata: Metadata = {
  title: 'ویرایش کد تخفیف',
};

type PageProps = { params: Promise<{ id: string }> };

/** صفحه اختصاصی ویرایش کد تخفیف — به‌جای مودال (فرم بیش از ۴ فیلد). */
export default async function EditCouponPage({ params }: PageProps) {
  const session = await requireSession('/coupons');

  if (!canAccessMenu(session, '/coupons', 'edit')) {
    redirect('/coupons');
  }

  const { id } = await params;
  const [coupons, customers, products, categories] = await Promise.all([
    listCoupons(),
    listCustomers(),
    listProducts(),
    listCategories(),
  ]);
  const coupon = coupons.find((row) => row.id === id);

  if (!coupon) {
    notFound();
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title={`ویرایش کد تخفیف ${coupon.code}`}
        description="تغییرات خود را ذخیره کنید."
      />
      <Card>
        <CouponForm
          initial={coupon}
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
