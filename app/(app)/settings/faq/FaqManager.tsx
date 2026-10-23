'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconCirclePlus, IconHelpCircle, IconPencil, IconTrash } from '@tabler/icons-react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import ResponsiveModal from '@/components/ui/panel/ResponsiveModal';
import type { FaqEntryDTO } from '@/lib/faq';
import { enNumber } from '@/lib/format';

/**
 * مدیریت سوالات متداول روی PanelList — فرم ۳ فیلدی (سوال/پاسخ/ترتیب) طبق قاعده
 * modal-to-page در ResponsiveModal می‌ماند (≤۴ فیلد). فعال/غیرفعال مستقیم روی
 * ردیف سوییچ می‌شود و ترتیب با همان فیلد عددی کنترل می‌شود.
 */
export default function FaqManager({
  initial,
  canAdd,
  canEdit,
}: {
  initial: FaqEntryDTO[];
  canAdd: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<FaqEntryDTO[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<FaqEntryDTO | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  // NumberInput هم رشته هم عدد می‌دهد — در save نرمال می‌شود.
  const [sortOrder, setSortOrder] = useState<string | number>('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);

  function openCreate() {
    setEditing(null);
    setQuestion('');
    setAnswer('');
    setSortOrder((entries.at(-1)?.sortOrder ?? 0) + 10);
    setIsActive(true);
    setFormError(null);
    open();
  }

  function openEdit(entry: FaqEntryDTO) {
    setEditing(entry);
    setQuestion(entry.question);
    setAnswer(entry.answer);
    setSortOrder(entry.sortOrder);
    setIsActive(entry.isActive);
    setFormError(null);
    open();
  }

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch('/api/admin/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          question,
          answer,
          sortOrder:
            typeof sortOrder === 'number'
              ? sortOrder
              : Number.parseInt(String(sortOrder), 10) || 0,
          isActive,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        entry?: FaqEntryDTO;
        error?: string;
      };
      if (!response.ok || !payload.entry) {
        setFormError(payload.error ?? 'ذخیره سوال ناموفق بود.');
        return;
      }
      const saved = payload.entry;
      setEntries((current) =>
        editing
          ? current.map((row) => (row.id === saved.id ? saved : row))
          : [...current, saved]
      );
      notifications.show({ message: editing ? 'سوال به‌روز شد.' : 'سوال ثبت شد.', color: 'brand' });
      close();
      router.refresh();
    } catch {
      setFormError('ذخیره سوال ناموفق بود. اتصال خود را بررسی کنید.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: FaqEntryDTO) {
    setBusyId(entry.id);
    try {
      const response = await fetch(`/api/admin/faq?id=${encodeURIComponent(entry.id)}`, {
        method: 'DELETE',
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'حذف سوال ناموفق بود.',
          color: 'red',
        });
        return;
      }
      notifications.show({ message: 'سوال حذف شد.', color: 'brand' });
      setEntries((current) => current.filter((row) => row.id !== entry.id));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(entry: FaqEntryDTO) {
    setBusyId(entry.id);
    try {
      const response = await fetch('/api/admin/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          question: entry.question,
          answer: entry.answer,
          sortOrder: entry.sortOrder,
          isActive: !entry.isActive,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        entry?: FaqEntryDTO;
        error?: string;
      };
      if (!response.ok || !payload.entry) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'تغییر وضعیت ناموفق بود.',
          color: 'red',
        });
        return;
      }
      const saved = payload.entry;
      setEntries((current) => current.map((row) => (row.id === saved.id ? saved : row)));
    } finally {
      setBusyId(null);
    }
  }

  const columns: PanelColumn<FaqEntryDTO>[] = [
    {
      key: 'sortOrder',
      header: 'ترتیب',
      w: 80,
      sortValue: (entry) => entry.sortOrder,
      cell: (entry) => <Text size="sm">{enNumber(entry.sortOrder)}</Text>,
    },
    {
      key: 'question',
      header: 'سوال',
      cardTitle: true,
      sortValue: (entry) => entry.question,
      cell: (entry) => (
        <Text size="sm" fw={600} style={{ minWidth: 0 }}>
          {entry.question}
        </Text>
      ),
      card: (entry) => entry.question,
    },
    {
      key: 'answer',
      header: 'پاسخ',
      desktopOnly: true,
      cell: (entry) => (
        <Text size="xs" c="dimmed" lineClamp={2} style={{ maxWidth: 420, minWidth: 0 }}>
          {entry.answer}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      cardHead: true,
      sortValue: (entry) => (entry.isActive ? 1 : 0),
      cell: (entry) =>
        canEdit ? (
          <Switch
            size="xs"
            checked={entry.isActive}
            disabled={busyId === entry.id}
            aria-label={entry.isActive ? 'غیرفعال‌کردن سوال' : 'فعال‌کردن سوال'}
            onChange={() => void toggleActive(entry)}
          />
        ) : (
          <Badge size="sm" variant="light" color={entry.isActive ? 'teal' : 'gray'}>
            {entry.isActive ? 'فعال' : 'غیرفعال'}
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: 'عملیات',
      w: 110,
      cell: (entry) =>
        canEdit ? (
          <Group gap="xs" wrap="nowrap">
            <Tooltip label="ویرایش">
              <ActionIcon
                variant="subtle"
                color="brand"
                aria-label={`ویرایش سوال ${entry.question}`}
                onClick={() => openEdit(entry)}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="حذف">
              <ActionIcon
                variant="subtle"
                color="red"
                disabled={busyId === entry.id}
                aria-label={`حذف سوال ${entry.question}`}
                onClick={() => void remove(entry)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null,
    },
  ];

  return (
    <Stack gap="md">
      {canAdd ? (
        <Group justify="flex-end">
          <Button
            variant="light"
            leftSection={<IconCirclePlus size={16} />}
            onClick={openCreate}
          >
            سوال جدید
          </Button>
        </Group>
      ) : null}

      <PanelList<FaqEntryDTO>
        rows={entries}
        columns={columns}
        getRowId={(entry) => entry.id}
        empty={{
          icon: IconHelpCircle,
          message: 'سوالی ثبت نشده است.',
          hint: canAdd
            ? 'با «سوال جدید» اولین پرسش را اضافه کنید — فعال‌ها در /faq نمایش داده می‌شوند.'
            : 'سوالات توسط مدیر وب‌سایت تعریف می‌شوند.',
        }}
      />

      <ResponsiveModal opened={opened} onClose={close} title={editing ? 'ویرایش سوال' : 'سوال جدید'}>
        <Stack gap="sm">
          <TextInput
            label="سوال"
            required
            maxLength={200}
            value={question}
            onChange={(event) => setQuestion(event.currentTarget.value)}
            data-autofocus
          />
          <Textarea
            label="پاسخ"
            required
            autosize
            minRows={4}
            maxLength={4000}
            value={answer}
            onChange={(event) => setAnswer(event.currentTarget.value)}
          />
          <Group gap="md" align="flex-end">
            <NumberInput
              label="ترتیب نمایش"
              description="عدد کوچک‌تر اول نشان داده می‌شود."
              min={0}
              value={sortOrder}
              onChange={setSortOrder}
              style={{ flex: 1 }}
            />
            <Switch
              label="فعال"
              checked={isActive}
              onChange={(event) => setIsActive(event.currentTarget.checked)}
              mb={4}
            />
          </Group>
          {formError ? (
            <Text size="sm" c="red">
              {formError}
            </Text>
          ) : null}
          <Group justify="end" gap="sm">
            <Button variant="subtle" color="gray" onClick={close}>
              انصراف
            </Button>
            <Button loading={saving} onClick={() => void save()}>
              {editing ? 'ذخیره تغییرات' : 'ثبت سوال'}
            </Button>
          </Group>
        </Stack>
      </ResponsiveModal>
    </Stack>
  );
}
