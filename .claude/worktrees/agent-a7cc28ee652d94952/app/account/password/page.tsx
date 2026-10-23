import type { Metadata } from 'next';
import { Card, Stack, Title } from '@mantine/core';
import ChangePasswordForm from '@/components/account/ChangePasswordForm';

export const metadata: Metadata = {
  title: 'تغییر گذرواژه',
};

/** Password change page — separate from the profile page on purpose. */
export default function AccountPasswordPage() {
  return (
    <Card withBorder>
      <Stack gap="md">
        <Title order={2} fz="h5">
          تغییر گذرواژه
        </Title>
        <ChangePasswordForm />
      </Stack>
    </Card>
  );
}
