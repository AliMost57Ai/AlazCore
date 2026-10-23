import type { DateValue } from '@mantine/dates';

/**
 * The one thing this app and PersianDateTimePicker disagree about.
 *
 * The picker's value is a `DateValue` (a `Date`, or the string it emits itself),
 * while every form, URL and API in this project speaks ISO 8601 — that is what
 * `lib/price-updates.ts`, `lib/coupons.ts` and the coupon/price-history query
 * strings parse with `new Date(iso)`.
 *
 * `valueFormat` is deliberately left unset on every picker: with no format,
 * dayjs emits its default `YYYY-MM-DDTHH:mm:ssZ`, which `new Date()` parses
 * everywhere. A display format such as `YYYY/MM/DD HH:mm` would emit a
 * *Gregorian* string shaped like `2026/09/24 14:05` — parseable in V8 and
 * nowhere else. The Jalali text the admin reads comes from `getDisplayValue`
 * (formatPersianDate), not from this value, so nothing is lost by omitting it.
 *
 * Normalising through `toISOString()` also makes the stored value independent
 * of the browser's zone: `showTime={false}` picks local midnight, which lands
 * here as that same instant in UTC, and `new Date(iso)` on the server reads it
 * back as local midnight. See the invariant listPriceChangeHistory documents.
 */
export function pickerToIso(value: DateValue): string {
  return value ? new Date(value).toISOString() : '';
}
