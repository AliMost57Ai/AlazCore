'use client';

import { TextInput, type TextInputProps } from '@mantine/core';
import { fromFaDigits } from '@/lib/format';

/** Iranian mobile: starts with 09, exactly 11 digits. */
export const PHONE_PATTERN = /^09\d{9}$/;

/**
 * A drop-in TextInput for Iranian mobile numbers: only digits are kept
 * (Persian digits are converted), a missing leading 0 is added automatically
 * when the number starts with 9, and the length is capped at 11 — so the
 * value in form state always starts with 09 and never exceeds 11 digits.
 *
 * Works with plain `getInputProps` spreads: the change event's value is
 * normalized before the form's own onChange sees it, so every existing
 * validation (PHONE_PATTERN) keeps working unchanged.
 */
export default function PhoneInput({ onChange, ...rest }: TextInputProps) {
  return (
    <TextInput
      dir="ltr"
      inputMode="tel"
      autoComplete="tel"
      styles={{ input: { textAlign: 'start' } }}
      {...rest}
      onChange={(event) => {
        let digits = fromFaDigits(event.target.value).replace(/\D/g, '');
        if (digits.startsWith('9')) {
          digits = `0${digits}`;
        }
        const next = digits.slice(0, 11);
        // Hand the normalized value to the form's handler, whichever of
        // target/currentTarget it reads (React 19 nulls currentTarget once
        // the dispatch is over).
        event.target.value = next;
        if (event.currentTarget) {
          event.currentTarget.value = next;
        }
        onChange?.(event);
      }}
    />
  );
}
