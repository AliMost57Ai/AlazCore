import type { Metadata } from 'next';
import { Card, Stack, Title } from '@mantine/core';
import ProfileForm from '@/components/account/ProfileForm';
import { requireSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { isLoginMethodForced } from '@/lib/login-method';
import { getAppSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'مشخصات حساب',
};

export const dynamic = 'force-dynamic';

/** Profile page: the customer's name, phone number and sign-in method. */
export default async function AccountProfilePage() {
  const session = await requireSession('/account');

  // The sign-in method row: the customer's own choice, unless the admin's
  // site-wide policy forces two-step/OTP on everyone.
  const [user, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.sub },
      select: { name: true, phone: true, loginMethod: true },
    }),
    getAppSettings(),
  ]);

  return (
    <Card withBorder>
      <Stack gap="md">
        <Title order={2} fz="h5">
          مشخصات
        </Title>
        <ProfileForm
          name={user?.name ?? session.name}
          phone={user?.phone ?? session.phone ?? ''}
          loginMethod={user?.loginMethod ?? 'password'}
          loginMethodLocked={isLoginMethodForced(settings.loginPolicy)}
        />
      </Stack>
    </Card>
  );
}
