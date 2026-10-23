'use client';

import { useState } from 'react';
import { Box } from '@mantine/core';
import { PersianDateTimePicker } from '@/components/PersianDateTimePicker/PersianDateTimePicker';

/**
 * فیلد تاریخ شمسی برای فرم‌های GET فیلتر لیست‌ها — PersianDateTimePicker با
 * یک input مخفی که مقدار YYYY-MM-DD را با `name` فرم می‌فرستد (قرارداد
 * پروژه: هر انتخاب تاریخی با PersianDateTimePicker؛ دسکتاپ popover، موبایل
 * modal که خود پیکر با dropdownType=auto انجام می‌دهد). عرض هم‌قد بقیه
 * فیلترهای ردیف فیلتر.
 */
export default function FaDateField({
  name,
  defaultValue = '',
  label,
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  label: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <Box w={{ base: '100%', xs: 190 }}>
      <input type="hidden" name={name} value={value} />
      <PersianDateTimePicker
        label={label}
        placeholder={placeholder ?? label}
        value={value ? `${value}T00:00:00` : undefined}
        valueFormat="YYYY-MM-DD"
        dateFormat="numeric"
        showTime={false}
        clearable
        size="default"
        fullWidth
        hideLabel
        onChange={(date) => setValue(typeof date === 'string' ? date : '')}
      />
    </Box>
  );
}
