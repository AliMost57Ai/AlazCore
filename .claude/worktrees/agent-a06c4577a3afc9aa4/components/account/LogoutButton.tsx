'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconLogout } from '@tabler/icons-react';
import { Button } from '@mantine/core';

/** Signs the customer out and returns to the storefront. */
export default function LogoutButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/');
      router.refresh();
    }
  }

  return (
    <Button
      variant="light"
      color="red"
      leftSection={<IconLogout size={16} />}
      loading={loading}
      onClick={handleClick}
      fullWidth={fullWidth}
    >
      خروج
    </Button>
  );
}
