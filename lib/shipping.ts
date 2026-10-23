/**
 * Shipping methods (روش‌های ارسال): admin-defined delivery options the
 * customer picks at checkout. Each carries a description, a minimum delivery
 * time, a minimum shipping cost, and whether that cost goes on the invoice —
 * false means پس‌کرایه: the courier collects it at handover instead, so the
 * checkout leaves it out of the payable amount.
 */

import prisma from './db';

export interface ShippingMethodDTO {
  id: string;
  name: string;
  description: string;
  /** 'courier' (ارسالی) | 'pickup' (تحویل حضوری — وابسته به pickupLocationId) */
  kind: 'courier' | 'pickup';
  /** نقطه تحویل حضوری این روش — فقط برای kind='pickup'. */
  pickupLocationId: string | null;
  minDeliveryDays: number;
  minShippingCost: number;
  isInvoiced: boolean;
  isActive: boolean;
}

export interface ShippingMethodInput {
  name: string;
  description: string;
  minDeliveryDays: number;
  minShippingCost: number;
  isInvoiced: boolean;
  isActive: boolean;
}

type MutationResult = { method: ShippingMethodDTO } | { error: string };

function toDTO(row: {
  id: string;
  name: string;
  description: string;
  kind: string;
  pickupLocationId: string | null;
  minDeliveryDays: number;
  minShippingCost: number;
  isInvoiced: boolean;
  isActive: boolean;
}): ShippingMethodDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind === 'pickup' ? 'pickup' : 'courier',
    pickupLocationId: row.pickupLocationId,
    minDeliveryDays: row.minDeliveryDays,
    minShippingCost: row.minShippingCost,
    isInvoiced: row.isInvoiced,
    isActive: row.isActive,
  };
}

/** All methods, newest last — the admin manager's list. */
export async function listShippingMethods(): Promise<ShippingMethodDTO[]> {
  const rows = await prisma.shippingMethod.findMany({
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toDTO);
}

/** The methods the customer can pick at checkout (active ones, in order). */
export async function listActiveShippingMethods(): Promise<ShippingMethodDTO[]> {
  const rows = await prisma.shippingMethod.findMany({
    where: { isActive: true },
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toDTO);
}

/** Validates input shared by create and update. */
function validateInput(input: ShippingMethodInput): string | null {
  if (input.name.trim().length < 2 || input.name.trim().length > 60) {
    return 'نام روش ارسال باید بین ۲ تا ۶۰ نویسه باشد.';
  }
  if (input.description.length > 300) {
    return 'توضیح روش ارسال نمی‌تواند بیشتر از ۳۰۰ نویسه باشد.';
  }
  if (
    !Number.isInteger(input.minDeliveryDays) ||
    input.minDeliveryDays < 0 ||
    input.minDeliveryDays > 90
  ) {
    return 'حداقل زمان ارسال باید روزی بین ۰ تا ۹۰ باشد.';
  }
  if (
    !Number.isInteger(input.minShippingCost) ||
    input.minShippingCost < 0 ||
    input.minShippingCost > 1_000_000_000
  ) {
    return 'حداقل هزینه ارسال نامعتبر است.';
  }
  return null;
}

export async function createShippingMethod(input: ShippingMethodInput): Promise<MutationResult> {
  const problem = validateInput(input);
  if (problem) {
    return { error: problem };
  }

  const row = await prisma.shippingMethod.create({
    data: {
      name: input.name.trim(),
      description: input.description.trim(),
      minDeliveryDays: input.minDeliveryDays,
      minShippingCost: input.minShippingCost,
      isInvoiced: input.isInvoiced,
      isActive: input.isActive,
    },
  });
  return { method: toDTO(row) };
}

export async function updateShippingMethod(
  id: string,
  input: ShippingMethodInput
): Promise<MutationResult> {
  const problem = validateInput(input);
  if (problem) {
    return { error: problem };
  }

  const existing = await prisma.shippingMethod.findUnique({ where: { id } });
  if (!existing) {
    return { error: 'روش ارسال یافت نشد.' };
  }

  const row = await prisma.shippingMethod.update({
    where: { id },
    data: {
      name: input.name.trim(),
      description: input.description.trim(),
      minDeliveryDays: input.minDeliveryDays,
      minShippingCost: input.minShippingCost,
      isInvoiced: input.isInvoiced,
      isActive: input.isActive,
    },
  });
  return { method: toDTO(row) };
}

/** Deletes a method outright (the order keeps its name/cost snapshot). */
export async function deleteShippingMethod(id: string): Promise<{ error: string } | { ok: true }> {
  const existing = await prisma.shippingMethod.findUnique({ where: { id } });
  if (!existing) {
    return { error: 'روش ارسال یافت نشد.' };
  }

  await prisma.shippingMethod.delete({ where: { id } });
  return { ok: true };
}

/**
 * فعال/غیرفعال‌کردن تحویل حضوری به‌عنوان روش ارسال برای یک نقطه — روشِ
 * kind='pickup'ِ وابسته به همان نقطه ساخته/روشن می‌شود. نام و توضیح از خود
 * نقطه می‌آید؛ هزینه/زمان ارسال برای مراجعه حضوری صفر است.
 */
export async function setPickupShippingMethod(
  locationId: string,
  active: boolean
): Promise<{ ok: true } | { error: string }> {
  const location = await prisma.pickupLocation.findUnique({ where: { id: locationId } });
  if (!location) {
    return { error: 'نقطه تحویل حضوری یافت نشد.' };
  }

  const existing = await prisma.shippingMethod.findFirst({
    where: { kind: 'pickup', pickupLocationId: locationId },
  });

  if (!existing) {
    // خاموش‌کردنِ نقطه‌ای که هرگز روش نشده = بی‌عملیات موفق.
    if (!active) {
      return { ok: true };
    }
    await prisma.shippingMethod.create({
      data: {
        name: `تحویل حضوری — ${location.title}`,
        description: `مراجعه مشتری به آدرس: ${location.address}`,
        kind: 'pickup',
        pickupLocationId: location.id,
        minDeliveryDays: 0,
        minShippingCost: 0,
        isInvoiced: false,
        isActive: true,
      },
    });
    return { ok: true };
  }

  await prisma.shippingMethod.update({
    where: { id: existing.id },
    data: { isActive: active },
  });
  return { ok: true };
}
