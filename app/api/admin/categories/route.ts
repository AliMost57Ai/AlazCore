import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import {
  createCategory,
  deleteCategory,
  getCategoryPlacements,
  listCategories,
  updateCategory,
  type CategoryInput,
} from '@/lib/categories';
import { resolveSectionPlacements } from '@/lib/theme-settings';

/** The category tree — any signed-in admin (the list is also embedded in
 *  server pages, but this route powers the manager page's mutations). */
export async function GET() {
  const session = await requireApiMenu('/settings/categories');
  if (session instanceof NextResponse) {
    return session;
  }

  return NextResponse.json({ categories: await listCategories() });
}

interface CategoryBody {
  id?: unknown;
  name?: unknown;
  parentId?: unknown;
  sectionIds?: unknown;
}

/** Creates (id absent) or renames/moves (id present) one category. */
export async function POST(request: NextRequest) {
  let body: CategoryBody;
  try {
    body = (await request.json()) as CategoryBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  if (body.parentId !== undefined && body.parentId !== null && typeof body.parentId !== 'string') {
    return NextResponse.json({ error: 'گروه والد نامعتبر است.' }, { status: 400 });
  }

  const updateId = typeof body.id === 'string' && body.id.trim() !== '' ? body.id.trim() : null;

  // Creating needs the add grant, changing an existing row the edit one.
  const session = await requireApiMenu('/settings/categories', updateId ? 'edit' : 'add');
  if (session instanceof NextResponse) {
    return session;
  }

  // Optional theme-section pins (بخش‌های نمایش در قالب فعال) — a group pin
  // applies to every product in the group's categories.
  const placements = await resolveSectionPlacements(
    body.sectionIds,
    updateId ? await getCategoryPlacements(updateId) : {},
    'sectionIds' in body
  );
  if (placements instanceof NextResponse) {
    return placements;
  }

  const input: CategoryInput = {
    name: typeof body.name === 'string' ? body.name : '',
    parentId: body.parentId === null ? null : (body.parentId as string | undefined),
    ...(placements !== null ? { placements } : {}),
  };

  const result = updateId ? await updateCategory(updateId, input) : await createCategory(input);

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, category: result.category });
}

/** Deletes one category. */
export async function DELETE(request: NextRequest) {
  const session = await requireApiMenu('/settings/categories', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'شناسه دسته الزامی است.' }, { status: 400 });
  }

  const result = await deleteCategory(id);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
