'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconFileSpreadsheet, IconUpload } from '@tabler/icons-react';
import { Alert, Button, Divider, FileInput, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';

export interface ImportPricesButtonProps {
  /** Export URL — doubles as the import template (xlsx with product + variant rows). */
  templateHref: string;
}

/**
 * Bulk price update from the exported Excel sheet: download the export (or
 * press «دریافت فایل نمونه»), edit the price column — including variant rows
 * (نوع column) — then upload the file here. Parsing happens server-side
 * (xlsx or CSV); rows are matched by product slug.
 */
export default function ImportPricesButton({ templateHref }: ImportPricesButtonProps) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    if (!file) {
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);

      const response = await fetch('/api/products/import-prices', {
        method: 'POST',
        body,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        updated?: number;
        skipped?: string[];
      };

      if (!response.ok) {
        setError(payload.error ?? 'وارد کردن قیمت‌ها ناموفق بود.');
        return;
      }

      notifications.show({
        title: 'قیمت‌ها به‌روزرسانی شد',
        message: `${payload.updated ?? 0} ردیف به‌روزرسانی شد.${
          payload.skipped && payload.skipped.length > 0
            ? ` ردیف‌های ناشناخته: ${payload.skipped.join('، ')}`
            : ''
        }`,
        color: payload.skipped && payload.skipped.length > 0 ? 'orange' : 'green',
      });
      setOpened(false);
      setFile(null);
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setOpened(true)}>
        وارد کردن قیمت‌ها
      </Button>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="وارد کردن قیمت‌ها از فایل"
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            فایل خروجی محصولات را دریافت کنید، ستون «قیمت (تومان)» را در اکسل ویرایش کنید و همان
            فایل را اینجا بارگذاری کنید. ردیف‌هایی که ستون «نوع» آن‌ها خالی باشد قیمت خود محصول را
            تغییر می‌دهند و ردیف‌های دارای نام نوع، قیمت همان نوع را (خالی بگذارید یعنی همان قیمت
            محصول).
          </Text>

          <Group gap="sm">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconFileSpreadsheet size={16} />}
              component="a"
              href={templateHref}
            >
              دریافت فایل نمونه
            </Button>
          </Group>

          <Divider />

          <FileInput
            label="فایل xlsx یا CSV قیمت‌ها"
            placeholder="products.xlsx"
            accept=".xlsx,.csv"
            value={file}
            onChange={setFile}
            clearable
          />

          {error ? (
            <Alert variant="light" color="red">
              {error}
            </Alert>
          ) : null}

          <Group justify="flex-end">
            <Button
              leftSection={<IconUpload size={16} />}
              loading={importing}
              disabled={!file}
              onClick={handleImport}
            >
              به‌روزرسانی قیمت‌ها
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
