'use client';

import dayjs, { type PluginFunc } from 'dayjs';
import jalaliday from 'jalaliday/dayjs';
import { DatePickerInput } from '@mantine/dates';

// The Jalali (Khorshidi) calendar for dayjs — this must run before any
// Mantine date component renders. Mantine's dates package uses the same
// dayjs module instance internally, so switching dayjs's default calendar
// here flips its month grids to Jalali too; the plugin also re-registers the
// 'fa' locale with the Khorshidi month names (فروردین…). Nothing else in the
// app formats dates with dayjs, so changing the global default is safe.
dayjs.extend(jalaliday);
dayjs.calendar('jalali');

// @mantine/dates round-trips dates as STRINGS internally:
// dayjs(x).format('YYYY-MM-DD') on one side, plain dayjs(str) on the other.
// With the global Jalali calendar the format side writes Jalali ("1405-06-24")
// but dayjs's parser reads Gregorian — each hop shifts the date ~621 years
// until jalaali-js throws "Invalid Jalaali year" the moment the calendar
// dropdown opens. Fix: date-only strings in the Jalali year range parse back
// AS Jalali, making the round-trip self-consistent. Years ≥ 1700 stay
// Gregorian (genuine Gregorian dates; Jalali years are 1300–1500 for
// centuries). Date objects and ISO datetime strings are untouched.
const jalaliStringRoundTrip: PluginFunc = (_option, Dayjs) => {
  // dayjs's types keep `parse` off the public prototype — reach it with a cast.
  const proto = Dayjs.prototype as unknown as {
    parse: (
      this: unknown,
      cfg: { date?: unknown; jalali?: boolean; [key: string]: unknown }
    ) => void;
  };
  const oldParse = proto.parse;
  proto.parse = function parseJalaliStrings(cfg) {
    const date = cfg.date;
    if (
      typeof date === 'string' &&
      !cfg.jalali &&
      /^\d{3,4}-\d{1,2}-\d{1,2}$/.test(date) &&
      Number(date.slice(0, 4)) >= 300 &&
      Number(date.slice(0, 4)) < 1700
    ) {
      oldParse.call(this, { ...cfg, jalali: true });
      return;
    }
    oldParse.call(this, cfg);
  };
};
dayjs.extend(jalaliStringRoundTrip);

export interface FaDatePickerProps {
  label?: string;
  placeholder?: string;
  description?: string;
  /** ISO value (or '' for none) — the parent form keeps ISO strings. */
  value: string;
  /** Called with ISO string ('' = cleared). */
  onChange: (iso: string) => void;
  clearable?: boolean;
  required?: boolean;
}

/**
 * The Persian (Jalali) date picker — the house rule since Batch K: every
 * date input in the admin/customer UI goes through this component.
 *
 * Mantine's DatePickerInput with locale="fa" on a jalaliday-powered dayjs
 * renders the real Khorshidi calendar (Persian months, Saturday-first week,
 * Friday marked as the weekend). Its onChange hands back the DISPLAY string
 * (valueFormat), which is a Jalali date like 1404/06/22 — that must be parsed
 * with dayjs's `{ jalali: true }` option, never `new Date()`, which would
 * read it as a Gregorian year.
 *
 * `popoverProps` lifts the calendar above open modals (Mantine modal sits at
 * z-index 200) and keeps it from stretching to modal width.
 */
export default function FaDatePicker({
  label,
  placeholder,
  description,
  value,
  onChange,
  clearable = true,
  required = false,
}: FaDatePickerProps) {
  const parsed = value ? new Date(value) : null;
  const shown = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

  return (
    <DatePickerInput
      label={label}
      placeholder={placeholder ?? 'یک تاریخ انتخاب کنید'}
      description={description}
      locale="fa"
      valueFormat="YYYY/MM/DD"
      firstDayOfWeek={6}
      weekendDays={[5]}
      value={shown}
      clearable={clearable}
      required={required}
      w="100%"
      popoverProps={{ withinPortal: true, zIndex: 300 }}
      onChange={(next: string | null) => {
        if (next === '' || next === null) {
          onChange('');
          return;
        }
        // The display string is a Jalali date — parse it back as one.
        const date = dayjs(next, { jalali: true });
        onChange(date.isValid() ? date.toISOString() : '');
      }}
    />
  );
}
