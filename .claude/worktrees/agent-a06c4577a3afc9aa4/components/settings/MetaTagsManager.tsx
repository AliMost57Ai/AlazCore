'use client';

import { useState } from 'react';
import { IconAlertCircle, IconCircleCheck, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { META_TAG_KINDS, type MetaTagDTO } from '@/lib/meta-tags';

export interface MetaTagsManagerProps {
  initial: MetaTagDTO[];
  /** Add/edit/delete only render for roles with meta:edit — the API enforces
   *  it regardless. */
  canEdit: boolean;
}

interface FormState {
  id: string | null;
  kind: string;
  title: string;
  content: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  kind: 'ga4',
  title: '',
  content: '',
  isActive: true,
};

/**
 * The meta-codes manager (تنظیمات ← کدهای متا): at least five typed slots —
 * GA4, Tag Manager, Search Console verification, Clarity, and a custom
 * <meta> tag. Each slot's value is validated server-side against its kind's
 * strict pattern, so a malicious snippet can never be stored or rendered.
 */
export default function MetaTagsManager({ initial, canEdit }: MetaTagsManagerProps) {
  const [tags, setTags] = useState<MetaTagDTO[]>(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const kindDef = META_TAG_KINDS.find((def) => def.kind === form.kind) ?? META_TAG_KINDS[0];

  function openCreate() {
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(tag: MetaTagDTO) {
    setForm({
      id: tag.id,
      kind: tag.kind,
      title: tag.title,
      content: tag.content,
      isActive: tag.isActive,
    });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/meta-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id ?? undefined,
          kind: form.kind,
          title: form.title,
          content: form.content,
          isActive: form.isActive,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        tag?: MetaTagDTO;
        error?: string;
      };
      if (!response.ok || !payload.tag) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'ذخیره کد متا ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }
      const saved = payload.tag;
      setTags((current) =>
        current.some((tag) => tag.id === saved.id)
          ? current.map((tag) => (tag.id === saved.id ? saved : tag))
          : [...current, saved]
      );
      setOpen(false);
      notifications.show({
        title: 'ذخیره شد',
        message: 'کد متا ذخیره شد.',
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

  async function remove(tag: MetaTagDTO) {
    const response = await fetch(`/api/admin/meta-tags?id=${encodeURIComponent(tag.id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      notifications.show({
        title: 'خطا',
        message: 'حذف کد متا ناموفق بود.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
      return;
    }
    setTags((current) => current.filter((candidate) => candidate.id !== tag.id));
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed" maw={520}>
          کدهای سوم‌شخص مثل تحلیل‌گرها و تاییدیه‌ها؛ مقدار هر نوع طبق قالب خودش اعتبارسنجی می‌شود و
          هیچ کد مخربی قابل درج نیست. کدهای فعال در صفحه اول فروشگاه تزریق می‌شوند.
        </Text>
        {canEdit ? (
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            افزودن کد متا
          </Button>
        ) : null}
      </Group>

      {tags.length === 0 ? (
        <Card withBorder radius="lg" py="xl">
          <Text size="sm" c="dimmed" ta="center">
            هنوز کد متایی ثبت نشده است.
          </Text>
        </Card>
      ) : (
        <Card withBorder radius="lg" p={0}>
          <Stack gap={0} p="sm">
            {tags.map((tag) => (
              <Group key={tag.id} justify="space-between" py="xs" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Badge
                    variant="light"
                    color={tag.isActive ? 'green' : 'gray'}
                    radius="sm"
                    size="sm"
                  >
                    {tag.isActive ? 'فعال' : 'غیرفعال'}
                  </Badge>
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} lineClamp={1}>
                      {tag.title}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {tag.kindLabel}
                    </Text>
                  </Stack>
                </Group>
                {canEdit ? (
                  <Group gap="xs" wrap="nowrap">
                    <Button size="compact-sm" variant="light" onClick={() => openEdit(tag)}>
                      ویرایش
                    </Button>
                    <Button
                      size="compact-sm"
                      variant="light"
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => remove(tag)}
                    >
                      حذف
                    </Button>
                  </Group>
                ) : null}
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title={form.id ? 'ویرایش کد متا' : 'افزودن کد متا'}
        centered
      >
        <Stack gap="sm">
          <Select
            label="نوع"
            data={META_TAG_KINDS.map((def) => ({ value: def.kind, label: def.label }))}
            value={form.kind}
            onChange={(value) => setForm((current) => ({ ...current, kind: value ?? 'ga4' }))}
            allowDeselect={false}
          />
          <TextInput
            label="عنوان"
            placeholder="مثلاً تحلیل‌گر فروشگاه"
            maxLength={80}
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
          <TextInput
            label="مقدار"
            description={kindDef.hint}
            dir="ltr"
            value={form.content}
            onChange={(event) =>
              setForm((current) => ({ ...current, content: event.target.value }))
            }
          />
          <Switch
            label="فعال"
            checked={form.isActive}
            onChange={(event) =>
              setForm((current) => ({ ...current, isActive: event.currentTarget.checked }))
            }
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button loading={saving} onClick={save}>
              ذخیره
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Title order={6} fz="xs" c="dimmed" fw={400}>
        این مقادیر فقط از طریق پنل مدیریت قابل تغییر هستند.
      </Title>
    </Stack>
  );
}
