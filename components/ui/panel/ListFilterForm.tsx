'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button, Group } from '@mantine/core';

/**
 * فرم فیلتر واحد لیست‌های پنل — فرم GET بومی با یک شکل ثابت: فیلدها در یک ردیف
 * (از xs به بالا)، دکمه «جستجو» و وقتی فیلتری فعال است لینک «حذف فیلترها».
 * همه لیست‌ها همین ترکیب را دارند تا رفتار فیلتر بین صفحات یکسان بماند.
 *
 * کلاینت است چون دکمه «حذف فیلترها» به Mantine Button با component={Link}
 * رندر می‌شود — از گراف سرور، تابع Link نمی‌تواند به کلاینت عبور کند و همه
 * لیست‌های فیلترشده را می‌شکست (دروازه RSC).
 */
export default function ListFilterForm({
  action,
  children,
  hasFilters = false,
  actions,
}: {
  action: string;
  children: ReactNode;
  /** حداقل یک فیلتر فعال است — لینک بازگشت به لیست بی‌فیلتر نشان داده می‌شود. */
  hasFilters?: boolean;
  /** عملیات ردیف فیلتر (مثل «کاربر جدید») — انتهای ردیف، خارج از جریان فیلترها. */
  actions?: ReactNode;
}) {
  const hasFields = children !== null && children !== undefined;

  return (
    <form method="get" action={action} className="no-print">
      <Group gap="sm" mb="md" wrap="wrap" align="flex-end">
        {children}
        {hasFields ? (
          <Button type="submit" variant="default" size="sm" radius="md">
            جستجو
          </Button>
        ) : null}
        {hasFilters ? (
          <Button
            component={Link}
            href={action}
            variant="subtle"
            color="gray"
            size="sm"
            radius="md"
          >
            حذف فیلترها
          </Button>
        ) : null}
        {actions ? (
          <Group gap="sm" style={{ marginInlineStart: 'auto' }}>
            {actions}
          </Group>
        ) : null}
      </Group>
    </form>
  );
}
