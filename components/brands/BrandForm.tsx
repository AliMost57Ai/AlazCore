'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPhoto } from '@tabler/icons-react';
import {
  Button,
  Card,
  Group,
  Image,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { BrandDTO } from '@/lib/brands';

/**
 * فرم تعریف/ویرایش برند — صفحه اختصاصی (قاعده modal-to-page). لوگو با همان
 * آپلود مشترک /api/upload (تصویر، سقف سروری) و اسلاگ خودکار از نام ساخته
 * می‌شود؛ سمت سرور هم دوباره اعتبارسنجی می‌شود.
 */
export default function BrandForm({ brand }: { brand?: BrandDTO }) {
  const router = useRouter();
  const [name, setName] = useState(brand?.name ?? '');
  const [logoPath, setLogoPath] = useState<string | null>(brand?.logoPath ?? null);
  const [isActive, setIsActive] = useState(brand?.isActive ?? true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function uploadLogo(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'بارگذاری لوگو انجام نشد.');
        return;
      }
      const payload = (await response.json()) as { path: string };
      setLogoPath(payload.path);
    } catch {
      setError('بارگذاری لوگو انجام نشد. اتصال خود را بررسی کنید.');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (name.trim().length < 2) {
      setError('نام برند باید حداقل ۲ نویسه باشد.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(brand ? { id: brand.id } : {}),
          name: name.trim(),
          logoPath,
          isActive,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'ثبت برند ناموفق بود.');
        return;
      }
      notifications.show({ message: brand ? 'برند به‌روز شد.' : 'برند ثبت شد.', color: 'brand' });
      router.push('/brands');
      router.refresh();
    } catch {
      setError('ثبت برند ناموفق بود. اتصال خود را بررسی کنید.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="lg" withBorder maw={640}>
      <Stack gap="md">
        <TextInput
          label="نام برند"
          required
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          placeholder="مثلاً سامسونگ"
          data-autofocus
        />

        <Stack gap={4}>
          <Text size="sm" fw={500}>
            لوگو (اختیاری)
          </Text>
          {logoPath ? (
            <Group gap="sm" wrap="nowrap">
              <Image
                src={`/api/files/${logoPath}`}
                alt="لوگوی برند"
                h={56}
                w={88}
                fit="contain"
                radius="sm"
                style={{ background: 'var(--mantine-color-gray-0)', border: '1px solid var(--mantine-color-gray-3)' }}
              />
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => setLogoPath(null)}
              >
                حذف لوگو
              </Button>
            </Group>
          ) : (
            <Group gap="sm" wrap="nowrap">
              <Button
                variant="light"
                leftSection={<IconPhoto size={16} />}
                loading={uploading}
                onClick={() => fileInput.current?.click()}
              >
                بارگذاری لوگو
              </Button>
              <Text size="xs" c="dimmed">
                PNG یا JPG — در کارت برند و فیلتر فروشگاه نمایش داده می‌شود.
              </Text>
            </Group>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadLogo(file);
              }
              event.target.value = '';
            }}
          />
        </Stack>

        <Switch
          label="فعال"
          description="برند غیرفعال از ویترین و فیلتر فروشگاه حذف می‌شود ولی داده‌اش می‌ماند."
          checked={isActive}
          onChange={(event) => setIsActive(event.currentTarget.checked)}
        />

        {error ? (
          <Text size="sm" c="red">
            {error}
          </Text>
        ) : null}

        <Group justify="end" gap="sm">
          <Button variant="subtle" color="gray" onClick={() => router.push('/brands')}>
            انصراف
          </Button>
          <Button loading={saving} onClick={() => void submit()}>
            {brand ? 'ذخیره تغییرات' : 'ثبت برند'}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
