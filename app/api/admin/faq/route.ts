import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import {
  createFaqEntry,
  deleteFaqEntry,
  listFaqEntries,
  updateFaqEntry,
  validateFaqInput,
} from '@/lib/faq';

/** GET — همه سوالات برای مدیر. */
export async function GET() {
  const session = await requireApiMenu('/settings/faq');
  if (session instanceof NextResponse) {
    return session;
  }
  return NextResponse.json({ entries: await listFaqEntries() });
}

/** POST — ایجاد (بدون id) یا ویرایش (با id) یک سوال. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const updateId = typeof body.id === 'string' && body.id.trim() !== '' ? body.id.trim() : null;
  const session = await requireApiMenu('/settings/faq', updateId ? 'edit' : 'add');
  if (session instanceof NextResponse) {
    return session;
  }

  const validated = validateFaqInput(body);
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const entry = updateId
    ? await updateFaqEntry(updateId, validated.value)
    : await createFaqEntry(validated.value);

  if (!entry) {
    return NextResponse.json({ error: 'سوال یافت نشد.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, entry });
}

/** DELETE — حذف یک سوال (?id=). */
export async function DELETE(request: NextRequest) {
  const session = await requireApiMenu('/settings/faq', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'شناسه سوال الزامی است.' }, { status: 400 });
  }

  const deleted = await deleteFaqEntry(id);
  if (!deleted) {
    return NextResponse.json({ error: 'سوال یافت نشد.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
