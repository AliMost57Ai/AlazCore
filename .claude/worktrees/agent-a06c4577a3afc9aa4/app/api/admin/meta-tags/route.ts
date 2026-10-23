import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { deleteMetaTag, listMetaTags, saveMetaTag, type SaveMetaTagInput } from '@/lib/meta-tags';

/** All configured meta-code slots — admin only. */
export async function GET() {
  const session = await requireApiMenu('/settings/meta');
  if (session instanceof NextResponse) {
    return session;
  }

  return NextResponse.json({ tags: await listMetaTags() });
}

/** Creates one slot (id absent) or updates one (id present). */
export async function POST(request: NextRequest) {
  let body: (SaveMetaTagInput & { id?: unknown }) | null = null;
  try {
    body = (await request.json()) as SaveMetaTagInput & { id?: unknown };
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }
  if (body === null || typeof body !== 'object') {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const id = typeof body.id === 'string' && body.id.trim() !== '' ? body.id.trim() : null;
  if (body.id !== undefined && body.id !== null && !id) {
    return NextResponse.json({ error: 'شناسه کد متا نامعتبر است.' }, { status: 400 });
  }

  // Creating needs the add grant, changing an existing slot the edit one.
  const session = await requireApiMenu('/settings/meta', id ? 'edit' : 'add');
  if (session instanceof NextResponse) {
    return session;
  }

  const result = await saveMetaTag(id, body);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, tag: result.tag });
}

/** Deletes one slot — needs the meta:edit grant. */
export async function DELETE(request: NextRequest) {
  const session = await requireApiMenu('/settings/meta', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'شناسه کد متا الزامی است.' }, { status: 400 });
  }

  await deleteMetaTag(id);
  return NextResponse.json({ ok: true });
}
