'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Badge, Box, Group, Input, PasswordInput, Stack, Switch, Text } from '@mantine/core';
import classes from './GatewayCredentialRow.module.css';

/** One inline credential input of the joined row. */
export interface GatewayRowField {
  /** The form field name (must be a key of the parent form's values). */
  name: string;
  /** Short in-row placeholder (the sample's «کد ترمینال», «رمز عبور», …). */
  placeholder: string;
  /** Render as a password field with a visibility (reveal) toggle. */
  password?: boolean;
  /** Relative width weight inside the row. */
  flex?: number;
}

export interface GatewayCredentialRowProps {
  label: string;
  fields: GatewayRowField[];
  /** key-free getInputProps spread for one field name. */
  inputProps: (name: string) => Record<string, unknown>;
  /** Trailing single-select switch state: this row is the selected one. Omit to hide it. */
  isSelected?: boolean;
  /** Flipping the switch selects (checked) / deselects (unchecked) this row. */
  onSelect?: (checked: boolean) => void;
  /** Visible label of the trailing single-select switch. */
  selectLabel?: string;
  /** Trailing toggle state. Omit to hide it. */
  isActive?: boolean;
  onActiveChange?: (checked: boolean) => void;
  /** Visible label of the trailing toggle. */
  activeLabel?: string;
  /** The admin hasn't entered this row's credentials yet. */
  configured?: boolean;
  /** Anything extra below the row (sandbox switch, note). */
  extra?: ReactNode;
}

/**
 * One provider's credential row (a payment gateway or an SMS panel): label
 * above, then a joined horizontal LTR input-group of inline inputs (each with
 * its own placeholder; password fields get a visibility toggle) ending in an
 * optional single-select «پیش‌فرض»/«انتخاب» switch and a «فعال» switch — the
 * layout of the bank-gateway/SMS-panel samples the admin picked, restyled
 * with this project's colors.
 */
export default function GatewayCredentialRow({
  label,
  fields,
  inputProps,
  isSelected,
  onSelect,
  selectLabel,
  isActive,
  onActiveChange,
  activeLabel,
  configured,
  extra,
}: GatewayCredentialRowProps) {
  return (
    <Stack gap={6}>
      <Group gap="xs" wrap="nowrap">
        <Text size="sm" fw={500}>
          {label}
        </Text>
        {configured === false ? (
          <Badge size="xs" variant="light" color="yellow">
            پیکربندی نشده
          </Badge>
        ) : null}
      </Group>
      <Box className={classes.row}>
        {fields.map((field) => {
          // The joined row shows errors once (under the row), never per cell.
          const { error: _error, ...spread } = inputProps(field.name);
          const shared = {
            key: field.name,
            variant: 'unstyled' as const,
            className: classes.field,
            style: { flex: field.flex ?? 1 },
            placeholder: field.placeholder,
            ...(spread as unknown as ComponentProps<typeof Input>),
          };
          return field.password ? <PasswordInput {...shared} /> : <Input {...shared} />;
        })}
        {onSelect ? (
          <Box className={classes.control} dir="rtl">
            <Switch
              size="sm"
              label={selectLabel ?? 'پیش‌فرض'}
              checked={isSelected ?? false}
              onChange={(event) => onSelect(event.currentTarget.checked)}
            />
          </Box>
        ) : null}
        {onActiveChange ? (
          <Box className={classes.control} dir="rtl">
            <Switch
              size="sm"
              label={activeLabel ?? 'فعال'}
              checked={isActive ?? false}
              onChange={(event) => onActiveChange(event.currentTarget.checked)}
            />
          </Box>
        ) : null}
      </Box>
      {extra}
    </Stack>
  );
}
