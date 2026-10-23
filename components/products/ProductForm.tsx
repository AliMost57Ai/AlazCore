'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import {
  Alert,
  Button,
  Card,
  Divider,
  FileInput,
  Group,
  Image as MantineImage,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { enNumber, fromFaDigits } from '@/lib/format';
import type { ProductDTO } from '@/lib/products';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface ProductFormProps {
  /** Create (POST) or edit (PATCH) mode. */
  mode: 'create' | 'edit';
  /** Present in edit mode: the product being changed. */
  product?: ProductDTO;
  /** All groups+categories as MultiSelect options (دسته‌بندی کالا). */
  categoryOptions: { value: string; label: string }[];
  /** All brands as Select options (برند کالا — اختیاری). */
  brandOptions: { value: string; label: string }[];
  /** مجوز خالی‌فروشی از لایسنس Core — null یعنی غیرفعال. */
  oversell?: { allowed: boolean; max: number } | null;
  /** آیا کاربر جاری اجازه تنظیم خالی‌فروشی دارد (ادمین یا قابلیت نقش). */
  canOversell: boolean;
  /** Present in edit mode: the product's current category ids. */
  categoryIds?: string[];
  /** The ACTIVE storefront theme's content sections (بخش‌های نمایش). */
  sectionOptions: { value: string; label: string }[];
  /** Persian name of the active theme, for the field description. */
  activeThemeName: string;
  /** Present in edit mode: the product's pinned sections for that theme. */
  sectionIds?: string[];
}

interface FormValues {
  name: string;
  price: string; // string so Persian-digit input keeps its exact form
  discountPercent: string; // '0'–'90', same string convention as price
  qty: string;
  reorderPoint: string;
  minStock: string;
  oversellAllowed: boolean;
  oversellMax: string;
  isVisible: boolean;
  props: { key: string; value: string }[];
  variants: { name: string; sku: string; price: string; qty: string }[];
}

/** Parses a digit string (Persian or ASCII) into a non-negative integer. */
function parseAmount(value: string | number): number | null {
  const ascii = fromFaDigits(value)
    .replace(/[,\s٬]/g, '')
    .trim();
  if (ascii === '' || !/^\d+$/.test(ascii)) {
    return null;
  }
  const parsed = Number(ascii);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export default function ProductForm({
  mode,
  product,
  categoryOptions,
  brandOptions,
  categoryIds,
  sectionOptions,
  activeThemeName,
  sectionIds,
  oversell,
  canOversell,
}: ProductFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const oversellEnabled = oversell?.allowed === true;
  const oversellMaxCap = oversell?.max ?? null;
  // بخش خالی‌فروشی فرم فقط با هر دو شرط: مجوز دامنه (لایسنس) + مجوز کاربر.
  const canConfigureOversell = oversellEnabled && canOversell && (oversellMaxCap ?? 0) >= 1;
  const [error, setError] = useState<string | null>(null);
  // Image paths already persisted for this product (uploads/…).
  const [images, setImages] = useState<string[]>(product?.images.map((image) => image.path) ?? []);
  const [uploading, setUploading] = useState(false);
  // Category assignment (گروه‌ها و دسته‌های کالا).
  const [selectedCategories, setSelectedCategories] = useState<string[]>(categoryIds ?? []);
  // برند کالا — اختیاری؛ null یعنی بدون برند.
  const [brandId, setBrandId] = useState<string | null>(product?.brandId ?? null);
  // Theme-section pins (بخش‌های نمایش در قالب فعال) — empty = show everywhere.
  const [selectedSections, setSelectedSections] = useState<string[]>(sectionIds ?? []);

  const form = useForm<FormValues>({
    mode: 'uncontrolled',
    initialValues: {
      name: product?.name ?? '',
      price: product ? String(product.price) : '',
      discountPercent: product ? String(product.discountPercent) : '0',
      qty: product ? String(product.qty) : '0',
      reorderPoint: product?.reorderPoint != null ? String(product.reorderPoint) : '',
      minStock: product?.minStock != null ? String(product.minStock) : '',
      oversellAllowed: product?.oversellAllowed ?? false,
      oversellMax: product?.oversellMax != null ? String(product.oversellMax) : '',
      isVisible: product?.isVisible ?? true,
      props: product?.props.map((prop) => ({ key: prop.key, value: prop.value })) ?? [
        { key: '', value: '' },
      ],
      variants:
        product?.variants.map((variant) => ({
          name: variant.name,
          sku: variant.sku ?? '',
          price: variant.price === null ? '' : String(variant.price),
          qty: String(variant.qty),
        })) ?? [],
    },
    validate: {
      name: (value) => (value.trim().length >= 2 ? null : 'نام محصول باید حداقل ۲ نویسه باشد.'),
      price: (value) => (parseAmount(value) !== null ? null : 'قیمت باید عددی نامنفی باشد.'),
      discountPercent: (value) => {
        const parsed = parseAmount(value);
        return parsed !== null && parsed <= 90 ? null : 'درصد تخفیف باید عددی بین ۰ تا ۹۰ باشد.';
      },
      qty: (value) => (parseAmount(value) !== null ? null : 'موجودی باید عددی نامنفی باشد.'),
      reorderPoint: (value) =>
        value.trim() === '' || parseAmount(value) !== null
          ? null
          : 'نقطه سفارش باید عددی نامنفی باشد.',
      minStock: (value) =>
        value.trim() === '' || parseAmount(value) !== null
          ? null
          : 'حداقل موجودی باید عددی نامنفی باشد.',
      oversellMax: (value) => {
        if (!canConfigureOversell || !form.values.oversellAllowed) {
          return null;
        }
        const parsed = parseAmount(value);
        if (parsed === null || parsed < 1) {
          return 'تعداد خالی‌فروشی باید عددی بزرگ‌تر از صفر باشد.';
        }
        if (oversellMaxCap !== null && parsed > oversellMaxCap) {
          return `سقف مجاز فروشگاه ${enNumber(oversellMaxCap)} عدد است.`;
        }
        return null;
      },
      variants: {
        name: (value) => (value.trim().length >= 1 ? null : 'نام نوع نمی‌تواند خالی باشد.'),
        qty: (value) => (parseAmount(value) !== null ? null : 'موجودی باید عددی نامنفی باشد.'),
        price: (value) =>
          value.trim() === '' || parseAmount(value) !== null
            ? null
            : 'قیمت نوع باید عددی نامنفی باشد.',
      },
    },
  });

  async function handleUpload(file: File) {
    if (file.size > MAX_IMAGE_BYTES) {
      setError('حجم تصویر باید حداکثر ۵ مگابایت باشد.');
      return;
    }
    // Early client check — the server re-checks magic bytes, this only saves a round trip.
    if (!file.type.startsWith('image/')) {
      setError('فقط فایل تصویری پذیرفته می‌شود.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'بارگذاری تصویر انجام نشد.');
        return;
      }

      const payload = (await response.json()) as { path: string };
      setImages((current) => [...current, payload.path]);
    } catch {
      setError('بارگذاری تصویر انجام نشد. اتصال خود را بررسی کنید.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(values: FormValues) {
    setSubmitting(true);
    setError(null);

    const price = parseAmount(values.price);
    const qty = parseAmount(values.qty);
    const discountPercent = parseAmount(values.discountPercent) ?? 0;
    if (price === null || qty === null || discountPercent > 90) {
      // Defensive: the validators above already block this.
      setError('قیمت و موجودی باید عددی نامنفی باشند.');
      setSubmitting(false);
      return;
    }

    const body = {
      name: values.name.trim(),
      price,
      discountPercent,
      qty,
      reorderPoint: values.reorderPoint.trim() === '' ? null : parseAmount(values.reorderPoint),
      minStock: values.minStock.trim() === '' ? null : parseAmount(values.minStock),
      // فیلدهای خالی‌فروشی فقط وقتی ارسال می‌شوند که بخش فرم دیده می‌شود —
      // در غیر این صورت سرور تنظیم موجود را در ویرایش حفظ می‌کند.
      ...(canConfigureOversell
        ? {
            oversellAllowed: values.oversellAllowed,
            oversellMax: values.oversellAllowed ? parseAmount(values.oversellMax) : null,
          }
        : {}),
      isVisible: values.isVisible,
      props: values.props
        .map((prop) => ({ key: prop.key.trim(), value: prop.value.trim() }))
        .filter((prop) => prop.key !== '' || prop.value !== ''),
      variants: values.variants
        .map((variant) => ({
          name: variant.name.trim(),
          sku: variant.sku.trim() || undefined,
          price: variant.price.trim() === '' ? undefined : (parseAmount(variant.price) ?? 0),
          qty: parseAmount(variant.qty) ?? 0,
        }))
        .filter((variant) => variant.name !== ''),
      images: images.map((path, index) => ({ path, sortOrder: index })),
      categoryIds: selectedCategories,
      brandId,
      sectionIds: selectedSections,
    };

    try {
      const response = await fetch(
        mode === 'create' ? '/api/products' : `/api/products/${product?.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'ذخیره محصول انجام نشد.');
        return;
      }

      notifications.show({
        title: mode === 'create' ? 'محصول افزوده شد' : 'تغییرات ذخیره شد',
        message: `«${body.name}» با موفقیت ذخیره شد.`,
        color: 'green',
      });
      router.push('/products');
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <Stack gap="lg">
        {error ? (
          <Alert
            variant="light"
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="ذخیره انجام نشد"
          >
            {error}
          </Alert>
        ) : null}

        <Card withBorder={false} p={0}>
          <Stack gap="md">
            <TextInput
              label="نام محصول"
              placeholder="مثلاً گوشی هوشمند آلفا ۱۲۸ گیگابایت"
              required
              key={form.key('name')}
              {...form.getInputProps('name')}
            />

            <MultiSelect
              label="دسته‌بندی‌ها"
              description="کالا می‌تواند هم‌زمان در چند دسته باشد — گروه‌ها و دسته‌ها از تنظیمات تعریف می‌شوند."
              placeholder="دسته‌ای انتخاب کنید"
              data={categoryOptions}
              value={selectedCategories}
              onChange={setSelectedCategories}
              searchable
              clearable
              hidePickedOptions
            />

            <Select
              label="برند"
              description="اختیاری — برندها از منوی «کالا ← برندها» تعریف می‌شوند و روی کارت و فیلتر فروشگاه نمایش داده می‌شوند."
              placeholder="برندی انتخاب نشده"
              data={brandOptions}
              value={brandId}
              onChange={setBrandId}
              searchable
              clearable
            />

            <MultiSelect
              label="بخش‌های نمایش در صفحه اول"
              description={`قالب فعال: ${activeThemeName} — خالی بگذارید تا محصول در همه بخش‌ها نمایش داده شود؛ پین کردن دسته‌های محصول هم به همین فهرست اضافه می‌شود.`}
              placeholder="همه بخش‌ها (بدون محدودیت)"
              data={sectionOptions}
              value={selectedSections}
              onChange={setSelectedSections}
              clearable
              hidePickedOptions
            />

            <Group gap="md" grow>
              {/* TextInput, not NumberInput: it always yields strings and keeps
                  Persian digits, which parseAmount understands (NumberInput
                  would strip them and call onChange with a number). */}
              <TextInput
                label="قیمت (تومان)"
                placeholder="۴۸۵۰۰۰۰۰"
                required
                inputMode="numeric"
                key={form.key('price')}
                {...form.getInputProps('price')}
              />
              <TextInput
                label="درصد تخفیف"
                description="۰ تا ۹۰ — روی همه نوع‌ها هم اعمال می‌شود."
                placeholder="۰"
                inputMode="numeric"
                key={form.key('discountPercent')}
                {...form.getInputProps('discountPercent')}
              />
              {/* کالای نوع‌دار: موجودی کل روی سرور از جمع نوع‌ها مشتق می‌شود —
                  مقدار این ورودی نادیده گرفته می‌شود، پس فقط نمایش است. */}
              <TextInput
                label="موجودی"
                description={
                  (product?.variants.length ?? 0) > 0
                    ? 'کالا نوع دارد — موجودی کل خودکار از جمع موجودی نوع‌ها محاسبه می‌شود.'
                    : undefined
                }
                placeholder="۱۲"
                required
                disabled={(product?.variants.length ?? 0) > 0}
                inputMode="numeric"
                key={form.key('qty')}
                {...form.getInputProps('qty')}
              />
            </Group>

            <Group gap="md" grow>
              <TextInput
                label="نقطه سفارش"
                description="با رسیدن موجودی به این عدد، کالا در «لیست خرید» داشبورد قرار می‌گیرد."
                placeholder="مثلاً ۵ — خالی = بدون هشدار"
                inputMode="numeric"
                key={form.key('reorderPoint')}
                {...form.getInputProps('reorderPoint')}
              />
              <TextInput
                label="حداقل موجودی"
                description="اخطار نهایی رو به اتمام برای مدیر فروشگاه."
                placeholder="مثلاً ۲ — خالی = بدون هشدار"
                inputMode="numeric"
                key={form.key('minStock')}
                {...form.getInputProps('minStock')}
              />
            </Group>

            {canConfigureOversell ? (
              <Group gap="md" align="flex-start">
                <Switch
                  label="خالی‌فروشی این کالا"
                  description="فروش کالا حتی با موجودی صفر، تا تعداد تعیین‌شده"
                  labelPosition="left"
                  key={form.key('oversellAllowed')}
                  {...form.getInputProps('oversellAllowed', { type: 'checkbox' })}
                />
                <TextInput
                  label={`تعداد خالی‌فروشی مجاز (۱ تا ${enNumber(oversellMaxCap ?? 0)})`}
                  description={`سقف کل فروشگاه از پنل آلازکور: ${enNumber(oversellMaxCap ?? 0)} عدد`}
                  placeholder="مثلاً ۳"
                  inputMode="numeric"
                  disabled={!form.values.oversellAllowed}
                  key={form.key('oversellMax')}
                  {...form.getInputProps('oversellMax')}
                />
              </Group>
            ) : null}

            <Switch
              label="نمایش در فروشگاه"
              description="محصول پنهان فقط در پنل مدیریت دیده می‌شود."
              labelPosition="left"
              key={form.key('isVisible')}
              {...form.getInputProps('isVisible', { type: 'checkbox' })}
            />
          </Stack>
        </Card>

        <Divider label="تصاویر" labelPosition="center" />

        <Stack gap="sm">
          <FileInput
            label="افزودن تصویر"
            placeholder="فایل PNG، JPG، WebP یا AVIF — حداکثر ۵ مگابایت"
            accept="image/png,image/jpeg,image/webp,image/avif"
            clearable
            leftSection={<IconUpload size={16} />}
            onChange={(file) => {
              if (file) {
                void handleUpload(file);
              }
            }}
            disabled={uploading}
          />

          {images.length > 0 ? (
            <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing="xs">
              {images.map((path, index) => (
                <Group key={path} justify="center" gap="xs" style={{ flexDirection: 'column' }}>
                  <MantineImage
                    src={`/api/files/${path}`}
                    h={80}
                    w="auto"
                    fit="contain"
                    radius="sm"
                    alt={`تصویر ${index + 1}`}
                    style={{ border: '1px solid var(--mantine-color-default-border)' }}
                  />
                  <Button
                    variant="subtle"
                    color="red"
                    size="compact-xs"
                    leftSection={<IconTrash size={12} />}
                    onClick={() => setImages((current) => current.filter((p) => p !== path))}
                    aria-label={`حذف تصویر ${enNumber(index + 1)}`}
                  >
                    حذف
                  </Button>
                </Group>
              ))}
            </SimpleGrid>
          ) : (
            <Text size="xs" c="dimmed">
              محصول بدون تصویر ذخیره می‌شود؛ می‌توانید بعداً تصویر بیفزایید.
            </Text>
          )}
        </Stack>

        <Divider label="ویژگی‌ها" labelPosition="center" />

        <Stack gap="xs">
          {form.values.props.map((_, index) => (
            <Group key={index} gap="xs" grow align="flex-start">
              <TextInput
                placeholder="کلید (مثلاً رنگ)"
                aria-label={`کلید ویژگی ${enNumber(index + 1)}`}
                key={form.key(`props.${index}.key`)}
                {...form.getInputProps(`props.${index}.key`)}
              />
              <TextInput
                placeholder="مقدار (مثلاً مشکی)"
                aria-label={`مقدار ویژگی ${enNumber(index + 1)}`}
                key={form.key(`props.${index}.value`)}
                {...form.getInputProps(`props.${index}.value`)}
              />
              <Button
                variant="subtle"
                color="red"
                size="sm"
                leftSection={<IconTrash size={14} />}
                onClick={() => form.removeListItem('props', index)}
                aria-label={`حذف ویژگی ${enNumber(index + 1)}`}
                mt={4}
              >
                حذف
              </Button>
            </Group>
          ))}
          <Button
            variant="light"
            size="sm"
            leftSection={<IconPlus size={14} />}
            onClick={() => form.insertListItem('props', { key: '', value: '' })}
          >
            افزودن ویژگی
          </Button>
        </Stack>

        <Divider label="نوع‌ها" labelPosition="center" />

        <Stack gap="xs">
          {form.values.variants.map((_, index) => (
            <Group key={index} gap="xs" grow align="flex-start" wrap="wrap">
              <TextInput
                placeholder="نام (مثلاً رنگ مشکی)"
                aria-label={`نام نوع ${enNumber(index + 1)}`}
                key={form.key(`variants.${index}.name`)}
                {...form.getInputProps(`variants.${index}.name`)}
              />
              <TextInput
                placeholder="SKU"
                dir="ltr"
                aria-label={`SKU نوع ${enNumber(index + 1)}`}
                key={form.key(`variants.${index}.sku`)}
                {...form.getInputProps(`variants.${index}.sku`)}
              />
              <TextInput
                placeholder="قیمت (خالی = قیمت محصول)"
                inputMode="numeric"
                aria-label={`قیمت نوع ${enNumber(index + 1)}`}
                key={form.key(`variants.${index}.price`)}
                {...form.getInputProps(`variants.${index}.price`)}
              />
              <TextInput
                placeholder="موجودی"
                inputMode="numeric"
                aria-label={`موجودی نوع ${enNumber(index + 1)}`}
                key={form.key(`variants.${index}.qty`)}
                {...form.getInputProps(`variants.${index}.qty`)}
              />
              <Button
                variant="subtle"
                color="red"
                size="sm"
                leftSection={<IconTrash size={14} />}
                onClick={() => form.removeListItem('variants', index)}
                aria-label={`حذف نوع ${enNumber(index + 1)}`}
                mt={4}
              >
                حذف
              </Button>
            </Group>
          ))}
          <Button
            variant="light"
            size="sm"
            leftSection={<IconPlus size={14} />}
            onClick={() =>
              form.insertListItem('variants', { name: '', sku: '', price: '', qty: '0' })
            }
          >
            افزودن نوع
          </Button>
        </Stack>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" component="a" href="/products" disabled={submitting}>
            انصراف
          </Button>
          <Button type="submit" loading={submitting || uploading}>
            {mode === 'create' ? 'ایجاد محصول' : 'ذخیره تغییرات'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
