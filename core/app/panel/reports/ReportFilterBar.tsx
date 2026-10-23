'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Group, Select, TextInput } from '@mantine/core';

/**
 * نوار فیلتر مشترک گزارشات — تاریخ از/تا، دامنه، گروه کالا و نام کالا.
 * تغییرها بلافاصله به query params می‌روند و صفحه سمت سرور دوباره گزارش
 * را با فیلتر می‌سازد.
 */
export default function ReportFilterBar({
  domains,
  categories,
  showCategory = true,
  showProduct = true,
  showDate = true,
}: {
  domains: { domain: string; ready: boolean }[];
  /** دسته‌های سایتِ انتخاب‌شده — فقط وقتی یک دامنه مشخص باشد پر می‌شود. */
  categories: { id: string; name: string }[];
  showCategory?: boolean;
  showProduct?: boolean;
  showDate?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // تغییر دامنه → دسته‌ی کالای سایت دیگر بی‌معناست؛ پاکش کن.
    if (key === 'domain') {
      params.delete('categoryId');
    }
    router.replace(`?${params.toString()}`);
  }

  const domain = searchParams.get('domain') ?? '';
  const categoryId = searchParams.get('categoryId') ?? '';

  return (
    <Group gap="sm" wrap="wrap">
      <Select
        label="دامنه سایت"
        placeholder="همه سایت‌ها"
        data={domains.map((d) => ({ value: d.domain, label: d.domain }))}
        value={domain || null}
        onChange={(value) => update('domain', value ?? '')}
        clearable
        w={200}
      />
      {showDate ? (
        <>
          <TextInput
            label="از تاریخ"
            type="date"
            value={searchParams.get('from') ?? ''}
            onChange={(e) => update('from', e.currentTarget.value)}
            w={170}
          />
          <TextInput
            label="تا تاریخ"
            type="date"
            value={searchParams.get('to') ?? ''}
            onChange={(e) => update('to', e.currentTarget.value)}
            w={170}
          />
        </>
      ) : null}
      {showCategory && domain ? (
        <Select
          label="گروه کالا"
          placeholder="همه گروه‌ها"
          data={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={categoryId || null}
          onChange={(value) => update('categoryId', value ?? '')}
          clearable
          w={200}
        />
      ) : null}
      {showProduct ? (
        <TextInput
          label="نام کالا"
          placeholder="جستجو در نام کالا…"
          defaultValue={searchParams.get('productName') ?? ''}
          onBlur={(e) => update('productName', e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              update('productName', (e.target as HTMLInputElement).value);
            }
          }}
          w={220}
        />
      ) : null}
    </Group>
  );
}
