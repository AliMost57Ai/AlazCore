/**
 * سوالات متداول فروشگاه — CRUD ساده با ترتیب نمایش. مدیریت در
 * /settings/faq (پنل) و نمایش عمومی در /faq (فروشگاه).
 *
 * Server-only — imports lib/db.
 */

import prisma from './db';

export interface FaqEntryDTO {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

export interface FaqInput {
  question: string;
  answer: string;
  sortOrder?: number;
  isActive?: boolean;
}

/** همه سوالات برای پنل — ترتیب مشخص، غیرفعال‌ها هم برای مدیریت. */
export async function listFaqEntries(): Promise<FaqEntryDTO[]> {
  const rows = await prisma.faqEntry.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toDTO);
}

/** سوالات فعال برای صفحه عمومی /faq — همان ترتیب پنل. */
export async function listActiveFaqEntries(): Promise<FaqEntryDTO[]> {
  const rows = await prisma.faqEntry.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toDTO);
}

function toDTO(row: {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}): FaqEntryDTO {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

/** اعتبارسنجی ورودی — خطای فارسی یا مقادیر تمیز. */
export function validateFaqInput(input: unknown): { value: FaqInput } | { error: string } {
  if (typeof input !== 'object' || input === null) {
    return { error: 'درخواست نامعتبر است.' };
  }
  const body = input as Record<string, unknown>;
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const answer = typeof body.answer === 'string' ? body.answer.trim() : '';
  if (question.length < 3 || question.length > 200) {
    return { error: 'سوال باید بین ۳ تا ۲۰۰ نویسه باشد.' };
  }
  if (answer.length < 3 || answer.length > 4000) {
    return { error: 'پاسخ باید بین ۳ تا ۴۰۰۰ نویسه باشد.' };
  }
  let sortOrder = 0;
  if (
    body.sortOrder !== undefined &&
    body.sortOrder !== null &&
    (typeof body.sortOrder !== 'number' || !Number.isInteger(body.sortOrder) || body.sortOrder < 0)
  ) {
    return { error: 'ترتیب نمایش باید عددی نامنفی باشد.' };
  }
  if (typeof body.sortOrder === 'number') {
    sortOrder = body.sortOrder;
  }
  return { value: { question, answer, sortOrder, isActive: body.isActive !== false } };
}

export async function createFaqEntry(input: FaqInput): Promise<FaqEntryDTO> {
  const row = await prisma.faqEntry.create({
    data: {
      question: input.question,
      answer: input.answer,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });
  return toDTO(row);
}

export async function updateFaqEntry(id: string, input: FaqInput): Promise<FaqEntryDTO | null> {
  const existing = await prisma.faqEntry.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return null;
  }
  const row = await prisma.faqEntry.update({
    where: { id },
    data: {
      question: input.question,
      answer: input.answer,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });
  return toDTO(row);
}

export async function deleteFaqEntry(id: string): Promise<boolean> {
  const deleted = await prisma.faqEntry.deleteMany({ where: { id } });
  return deleted.count > 0;
}
