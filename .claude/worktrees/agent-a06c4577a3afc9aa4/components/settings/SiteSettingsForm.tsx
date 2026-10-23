'use client';

import { useState } from 'react';
import { IconAlertCircle, IconCircleCheck, IconPhoto } from '@tabler/icons-react';
import {
  Button,
  Card,
  FileInput,
  Group,
  Image,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import PhoneInput from '@/components/ui/PhoneInput';
import type { SiteSettings } from '@/lib/theme-settings';

export interface SiteSettingsFormProps {
  initial: SiteSettings;
  /** View-only roles see the values but every control is disabled — the API
   *  enforces the site:edit grant regardless. */
  canEdit: boolean;
}

interface FormValues {
  siteName: string;
  siteUrl: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  aboutUs: string;
  enamadUrl: string;
  mediaUrl: string;
}

/**
 * Site identity form (تنظیمات ← مشخصات سایت): name, URL, contact info,
 * about text, and enamad/رسانه badge uploads + links (rendered in the
 * storefront footer), plus logo + favicon uploads (stored through the
 * existing /api/upload endpoint). Third-party meta codes live in their own
 * /settings/meta page.
 */
export default function SiteSettingsForm({ initial, canEdit }: SiteSettingsFormProps) {
  const form = useForm<FormValues>({
    mode: 'uncontrolled',
    initialValues: {
      siteName: initial.siteName,
      siteUrl: initial.siteUrl,
      contactPhone: initial.contactPhone,
      contactEmail: initial.contactEmail,
      contactAddress: initial.contactAddress,
      aboutUs: initial.aboutUs,
      enamadUrl: initial.enamadUrl,
      mediaUrl: initial.mediaUrl,
    },
  });

  const [logoPath, setLogoPath] = useState(initial.logoPath);
  const [faviconPath, setFaviconPath] = useState(initial.faviconPath);
  const [enamadPath, setEnamadPath] = useState(initial.enamadPath);
  const [mediaPath, setMediaPath] = useState(initial.mediaPath);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [enamadFile, setEnamadFile] = useState<File | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  /** Uploads one file via /api/upload, returning its stored path. */
  async function upload(file: File): Promise<string> {
    const data = new FormData();
    data.append('file', file);
    const response = await fetch('/api/upload', { method: 'POST', body: data });
    const payload = (await response.json().catch(() => ({}))) as { path?: string; error?: string };
    if (!response.ok || !payload.path) {
      throw new Error(payload.error ?? 'بارگذاری فایل ناموفق بود.');
    }
    return payload.path;
  }

  async function handleSubmit(values: FormValues) {
    setSaving(true);
    try {
      let nextLogo = logoPath;
      let nextFavicon = faviconPath;
      let nextEnamad = enamadPath;
      let nextMedia = mediaPath;

      if (logoFile) {
        nextLogo = await upload(logoFile);
      }
      if (faviconFile) {
        nextFavicon = await upload(faviconFile);
      }
      if (enamadFile) {
        nextEnamad = await upload(enamadFile);
      }
      if (mediaFile) {
        nextMedia = await upload(mediaFile);
      }

      const response = await fetch('/api/admin/site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName: values.siteName,
          siteUrl: values.siteUrl,
          contactPhone: values.contactPhone,
          contactEmail: values.contactEmail,
          contactAddress: values.contactAddress,
          aboutUs: values.aboutUs,
          enamadUrl: values.enamadUrl,
          mediaUrl: values.mediaUrl,
          logoPath: nextLogo,
          faviconPath: nextFavicon,
          enamadPath: nextEnamad,
          mediaPath: nextMedia,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        settings?: SiteSettings;
        error?: string;
      };

      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'ذخیره تنظیمات سایت ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }

      if (payload.settings) {
        form.setValues({
          siteName: payload.settings.siteName,
          siteUrl: payload.settings.siteUrl,
          contactPhone: payload.settings.contactPhone,
          contactEmail: payload.settings.contactEmail,
          contactAddress: payload.settings.contactAddress,
          aboutUs: payload.settings.aboutUs,
          enamadUrl: payload.settings.enamadUrl,
          mediaUrl: payload.settings.mediaUrl,
        });
        setLogoPath(payload.settings.logoPath);
        setFaviconPath(payload.settings.faviconPath);
        setEnamadPath(payload.settings.enamadPath);
        setMediaPath(payload.settings.mediaPath);
      }
      setLogoFile(null);
      setFaviconFile(null);
      setEnamadFile(null);
      setMediaFile(null);

      notifications.show({
        title: 'ذخیره شد',
        message: 'مشخصات سایت به‌روزرسانی شد.',
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
    } catch (error) {
      notifications.show({
        title: 'خطا',
        message: error instanceof Error ? error.message : 'ارتباط با سرور برقرار نشد.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setSaving(false);
    }
  }

  /** Reusable uploader row: file picker + current image + remove button. */
  function badgeUpload(
    label: string,
    description: string,
    file: File | null,
    setFile: (file: File | null) => void,
    path: string,
    setPath: (path: string) => void,
    imageHeight: number
  ) {
    return (
      <Stack gap={4}>
        <FileInput
          clearable
          accept="image/png,image/jpeg,image/webp"
          label={label}
          description={description}
          value={file}
          onChange={setFile}
        />
        {path ? (
          <Group gap="xs">
            <Image src={`/api/files/${path}`} alt={label} h={imageHeight} w="auto" fit="contain" />
            <Button size="compact-xs" variant="light" color="red" onClick={() => setPath('')}>
              حذف
            </Button>
          </Group>
        ) : (
          <Text size="xs" c="dimmed">
            تصویری بارگذاری نشده است.
          </Text>
        )}
      </Stack>
    );
  }

  return (
    // A disabled fieldset turns every nested control read-only in one place —
    // view-only roles can still read all values.
    <fieldset disabled={!canEdit} style={{ border: 'none', padding: 0, margin: 0 }}>
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap="md">
          {/* --- identity --------------------------------------------------- */}
          <Card withBorder radius="lg">
            <Stack gap="md">
              <Group gap="xs" c="dimmed">
                <IconPhoto size={16} />
                <Text size="sm" fw={600}>
                  هویت سایت
                </Text>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="نام سایت"
                  description="در هدر فروشگاه، عنوان تب مرورگر و فوتر نمایش داده می‌شود."
                  maxLength={60}
                  key={form.key('siteName')}
                  {...form.getInputProps('siteName')}
                />
                <TextInput
                  label="نشانی سایت (URL)"
                  description="مثلاً https://example.com"
                  dir="ltr"
                  key={form.key('siteUrl')}
                  {...form.getInputProps('siteUrl')}
                />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {badgeUpload(
                  'لوگو',
                  'PNG/JPG/WebP تا ۵ مگابایت — خالی بماند یعنی بدون تغییر.',
                  logoFile,
                  setLogoFile,
                  logoPath,
                  setLogoPath,
                  36
                )}
                {badgeUpload(
                  'فاوآیکون',
                  'نمایش داده می‌شود — خالی بماند یعنی بدون تغییر.',
                  faviconFile,
                  setFaviconFile,
                  faviconPath,
                  setFaviconPath,
                  24
                )}
              </SimpleGrid>
            </Stack>
          </Card>

          {/* --- contact ---------------------------------------------------- */}
          <Card withBorder radius="lg">
            <Stack gap="md">
              <Text size="sm" fw={600} c="dimmed">
                اطلاعات تماس
              </Text>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <PhoneInput
                  label="شماره تماس"
                  placeholder="09121234567"
                  key={form.key('contactPhone')}
                  {...form.getInputProps('contactPhone')}
                />
                <TextInput
                  label="ایمیل"
                  dir="ltr"
                  key={form.key('contactEmail')}
                  {...form.getInputProps('contactEmail')}
                />
              </SimpleGrid>

              <TextInput
                label="نشانی"
                maxLength={300}
                key={form.key('contactAddress')}
                {...form.getInputProps('contactAddress')}
              />
            </Stack>
          </Card>

          {/* --- content + badges -------------------------------------------- */}
          <Card withBorder radius="lg">
            <Stack gap="md">
              <Text size="sm" fw={600} c="dimmed">
                محتوا و نشان‌های اعتماد
              </Text>

              <Textarea
                label="درباره ما"
                description="در فوتر قالب‌های فروشگاه نمایش داده می‌شود."
                autosize
                minRows={3}
                maxLength={4000}
                key={form.key('aboutUs')}
                {...form.getInputProps('aboutUs')}
              />

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {badgeUpload(
                  'نشان اینماد',
                  'تصویر نشان اینماد — در فوتر فروشگاه نمایش داده می‌شود.',
                  enamadFile,
                  setEnamadFile,
                  enamadPath,
                  setEnamadPath,
                  64
                )}
                {badgeUpload(
                  'نشان رسانه',
                  'لوگوی رسانه/ساماندهی — در فوتر کنار اینماد نمایش داده می‌شود.',
                  mediaFile,
                  setMediaFile,
                  mediaPath,
                  setMediaPath,
                  64
                )}
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="لینک نشان اینماد"
                  description="نشانی صفحهی نشان در trustseal.enamad.ir — خالی بماند یعنی بدون لینک."
                  dir="ltr"
                  key={form.key('enamadUrl')}
                  {...form.getInputProps('enamadUrl')}
                />
                <TextInput
                  label="لینک نشان رسانه"
                  description="نشانی صفحهی نشان رسانه — خالی بماند یعنی بدون لینک."
                  dir="ltr"
                  key={form.key('mediaUrl')}
                  {...form.getInputProps('mediaUrl')}
                />
              </SimpleGrid>
            </Stack>
          </Card>

          <Group justify="flex-end">
            {canEdit ? (
              <Button type="submit" loading={saving}>
                ذخیره تنظیمات
              </Button>
            ) : (
              <Text size="sm" c="dimmed">
                برای نقش شما فقط مشاهدهٔ این تنظیمات مجاز است.
              </Text>
            )}
          </Group>

          <Title order={6} fz="xs" c="dimmed" fw={400}>
            این مقادیر فقط از طریق پنل مدیریت قابل تغییر هستند.
          </Title>
        </Stack>
      </form>
    </fieldset>
  );
}
