'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconFilter, IconFilterOff } from '@tabler/icons-react';
import { Button, Card, Group, Select, SimpleGrid } from '@mantine/core';
import { PersianDateTimePicker } from '@/components/ui/PersianDateTimePicker/PersianDateTimePicker';
import { pickerToIso } from '@/components/ui/PersianDateTimePicker/pickerValue';

export interface PriceHistoryFilterOption {
  value: string;
  label: string;
}

export interface PriceHistoryFiltersProps {
  /** Group/category options as «گروه › دسته» (ids are category ids). */
  categories: PriceHistoryFilterOption[];
  /** Every product, as a searchable option list. */
  products: PriceHistoryFilterOption[];
  /** Values from the URL, so the form and the results never disagree. */
  initial: { from: string; to: string; category: string; product: string };
}

/**
 * The /price-history filter bar: date range (Jalali pickers — the house rule is
 * that no date input uses the browser's calendar), product group/category and a
 * single product.
 *
 * Values are applied through the URL rather than local state, so a filtered view
 * is linkable and the server component stays the single source of truth for
 * what is on screen. Picking a product widens past the chosen group on purpose
 * (the server gives the product precedence), and the hint below says so.
 */
export default function PriceHistoryFilters({
  categories,
  products,
  initial,
}: PriceHistoryFiltersProps) {
  const router = useRouter();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [category, setCategory] = useState<string | null>(initial.category || null);
  const [product, setProduct] = useState<string | null>(initial.product || null);

  const dirty = from !== '' || to !== '' || category !== null || product !== null;

  function push(next: {
    from: string;
    to: string;
    category: string | null;
    product: string | null;
  }) {
    const query = new URLSearchParams();
    if (next.from) {
      query.set('from', next.from);
    }
    if (next.to) {
      query.set('to', next.to);
    }
    if (next.category) {
      query.set('category', next.category);
    }
    if (next.product) {
      query.set('product', next.product);
    }
    // No `page`: any filter change starts from the first page.
    const search = query.toString();
    router.push(search === '' ? '/price-history' : `/price-history?${search}`);
  }

  function clearAll() {
    setFrom('');
    setTo('');
    setCategory(null);
    setProduct(null);
    router.push('/price-history');
  }

  return (
    <Card withBorder padding="md">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
        {/*
          The form's state stays ISO (what the URL and lib/price-updates.ts
          speak); the picker shows Jalali and hands back ISO. showTime is off,
          so a picked day converts to that day's local midnight — the invariant
          listPriceChangeHistory documents. See pickerValue.ts for the why.
        */}
        <PersianDateTimePicker
          label="از تاریخ"
          dateFormat="numeric"
          showTime={false}
          clearable
          value={from || null}
          onChange={(next) => setFrom(pickerToIso(next))}
        />
        <PersianDateTimePicker
          label="تا تاریخ"
          dateFormat="numeric"
          showTime={false}
          clearable
          value={to || null}
          onChange={(next) => setTo(pickerToIso(next))}
        />
        <Select
          label="گروه کالا / دسته"
          placeholder="همه گروه‌ها"
          data={categories}
          searchable
          clearable
          value={category}
          onChange={setCategory}
        />
        <Select
          label="کالا"
          placeholder="همه کالاها"
          data={products}
          searchable
          clearable
          value={product}
          onChange={setProduct}
        />
      </SimpleGrid>

      <Group justify="space-between" mt="md" gap="sm">
        <Button
          variant="subtle"
          size="sm"
          leftSection={<IconFilterOff size={16} />}
          disabled={!dirty}
          onClick={clearAll}
        >
          پاک کردن فیلترها
        </Button>
        <Button
          size="sm"
          leftSection={<IconFilter size={16} />}
          onClick={() => push({ from, to, category, product })}
        >
          اعمال فیلتر
        </Button>
      </Group>
    </Card>
  );
}
