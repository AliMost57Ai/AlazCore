'use client';

import { useState } from 'react';
import {
  IconAlertCircle,
  IconChevronDown,
  IconCircleCheck,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { CategoryDTO } from '@/lib/categories';
import { faNumber } from '@/lib/format';

export interface CategoriesManagerProps {
  initial: CategoryDTO[];
  /** The ACTIVE storefront theme's content sections (بخش‌های نمایش). */
  sectionOptions: { value: string; label: string }[];
  /** Persian name of the active theme, for the field description. */
  activeThemeName: string;
  /** The active theme id — placements in the tree are keyed by it. */
  activeThemeId: string;
  /** The add buttons only render for roles with categories:add. */
  canAdd: boolean;
  /** Edit/delete only render for roles with categories:edit — the API
   *  enforces it regardless. */
  canEdit: boolean;
}

interface FormState {
  id: string | null;
  name: string;
  parentId: string | null;
  sectionIds: string[];
}

const EMPTY_FORM: FormState = { id: null, name: '', parentId: null, sectionIds: [] };

/** Groups (roots) for the parent Select — children can't be parents. */
function groupOptions(tree: CategoryDTO[]): { value: string; label: string }[] {
  return [
    { value: '', label: '— گروه جدید (بدون والد) —' },
    ...tree.map((node) => ({ value: node.id, label: node.name })),
  ];
}

/**
 * The category manager (دسته‌بندی کالا): two-level tree of groups and their
 * categories with add / rename / move / delete. Deleting is blocked while a
 * node still has children or assigned products.
 */
export default function CategoriesManager({
  initial,
  sectionOptions,
  activeThemeName,
  activeThemeId,
  canAdd,
  canEdit,
}: CategoriesManagerProps) {
  const [tree, setTree] = useState<CategoryDTO[]>(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initial.map((node) => [node.id, true]))
  );

  async function refresh() {
    const response = await fetch('/api/admin/categories');
    const payload = (await response.json().catch(() => ({}))) as {
      categories?: CategoryDTO[];
    };
    if (response.ok && payload.categories) {
      setTree(payload.categories);
    }
  }

  function openCreate(parentId: string | null) {
    setForm({ id: null, name: '', parentId, sectionIds: [] });
    setOpen(true);
  }

  function openEdit(node: CategoryDTO, parentId: string | null) {
    setForm({
      id: node.id,
      name: node.name,
      parentId,
      sectionIds: node.placements[activeThemeId] ?? [],
    });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id ?? undefined,
          name: form.name,
          parentId: form.parentId === '' ? null : form.parentId,
          sectionIds: form.sectionIds,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'ذخیره دسته ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }
      setOpen(false);
      await refresh();
      notifications.show({
        title: 'ذخیره شد',
        message: 'دسته‌بندی ذخیره شد.',
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

  async function remove(node: CategoryDTO) {
    const response = await fetch(`/api/admin/categories?id=${encodeURIComponent(node.id)}`, {
      method: 'DELETE',
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      notifications.show({
        title: 'خطا',
        message: payload.error ?? 'حذف دسته ناموفق بود.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
      return;
    }
    await refresh();
  }

  function renderNode(node: CategoryDTO, parentId: string | null, depth: number) {
    const isGroup = node.parentId === null;
    const isExpanded = expanded[node.id] ?? true;
    return (
      <Stack key={node.id} gap={0}>
        <Group justify="space-between" py={6} wrap="nowrap">
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, paddingInlineStart: depth * 24 }}>
            {isGroup ? (
              <IconChevronDown
                size={14}
                style={{
                  transform: isExpanded ? 'none' : 'rotate(-90deg)',
                  transition: 'transform 0.15s ease',
                  flexShrink: 0,
                }}
                onClick={() => setExpanded((current) => ({ ...current, [node.id]: !isExpanded }))}
              />
            ) : null}
            <Text size="sm" fw={isGroup ? 700 : 500} lineClamp={1}>
              {node.name}
            </Text>
            <Badge variant="light" color={isGroup ? 'blue' : 'gray'} radius="sm" size="sm">
              {isGroup ? 'گروه' : 'دسته'}
            </Badge>
            <Text size="xs" c="dimmed">
              {node.productCount} کالا
            </Text>
            {(node.placements[activeThemeId] ?? []).length > 0 ? (
              <Badge variant="light" color="grape" radius="sm" size="sm">
                {faNumber((node.placements[activeThemeId] ?? []).length)} بخش
              </Badge>
            ) : null}
          </Group>
          <Group gap={6} wrap="nowrap">
            {canAdd && isGroup ? (
              <Button size="compact-xs" variant="light" onClick={() => openCreate(node.id)}>
                زیردسته
              </Button>
            ) : null}
            {canEdit ? (
              <>
                <Button size="compact-xs" variant="light" onClick={() => openEdit(node, parentId)}>
                  ویرایش
                </Button>
                <Button
                  size="compact-xs"
                  variant="light"
                  color="red"
                  leftSection={<IconTrash size={12} />}
                  onClick={() => remove(node)}
                >
                  حذف
                </Button>
              </>
            ) : null}
          </Group>
        </Group>
        {isGroup && isExpanded
          ? node.children.map((child) => renderNode(child, node.id, depth + 1))
          : null}
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed" maw={520}>
          گروه‌ها و دسته‌های کالا — ساختار دو سطحی: گروه ← دسته. کالاها از فرم خودشان به دسته‌ها
          منتسب می‌شوند و کدهای تخفیف می‌توانند بر اساس دسته محدود شوند.
        </Text>
        {canAdd ? (
          <Button leftSection={<IconPlus size={16} />} onClick={() => openCreate(null)}>
            گروه جدید
          </Button>
        ) : null}
      </Group>

      <Card withBorder radius="lg" p="sm">
        {tree.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            هنوز گروه یا دسته‌ای تعریف نشده است.
          </Text>
        ) : (
          <Stack gap={0}>{tree.map((node) => renderNode(node, null, 0))}</Stack>
        )}
      </Card>

      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title={form.id ? 'ویرایش دسته' : 'افزودن دسته'}
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="نام"
            placeholder="مثلاً موبایل"
            maxLength={60}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <Select
            label="گروه والد"
            description="والد خالی یعنی خودش یک گروه باشد."
            data={groupOptions(tree)}
            value={form.parentId ?? ''}
            onChange={(value) => setForm((current) => ({ ...current, parentId: value ?? '' }))}
            allowDeselect={false}
          />
          <MultiSelect
            label="بخش‌های نمایش در صفحه اول"
            description={`قالب فعال: ${activeThemeName} — خالی بگذارید تا این گروه/دسته و محصولاتش در همه بخش‌ها نمایش داده شوند. پین محصولاتِ داخل دسته هم به همین فهرست اضافه می‌شود.`}
            placeholder="همه بخش‌ها (بدون محدودیت)"
            data={sectionOptions}
            value={form.sectionIds}
            onChange={(value) => setForm((current) => ({ ...current, sectionIds: value ?? [] }))}
            clearable
            hidePickedOptions
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
    </Stack>
  );
}
