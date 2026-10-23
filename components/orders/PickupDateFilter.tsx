'use client';

import FaDateField from '@/components/ui/FaDateField';

export interface PickupDateFilterProps {
  /** مقدار اولیه ISO yyyy-mm-dd از searchParams. */
  initial: string;
}

/**
 * فیلتر «روز تحویل» لیست تحویل حضوری — همان قرارداد مشترک فیلد تاریخ فرم
 * GET (PersianDateTimePicker + hidden input) روی FaDateField.
 */
export default function PickupDateFilter({ initial }: PickupDateFilterProps) {
  return <FaDateField name="date" defaultValue={initial} label="روز تحویل (اختیاری)" />;
}
