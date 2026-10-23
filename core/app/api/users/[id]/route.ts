import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, makeSalt, requireApiAdmin, resolveCoreRole } from '@/lib/auth';

interface UserPatchBody {
  name?: unknown;
  role?: unknown;
  password?: unknown;
  isActive?: unknown;
}

/** PATCH /api/users/[id] — ویرایش کاربر/تغییر رمز/غیرفعال‌سازی (مدیر کل).
 *  مدیر کلِ خودش را غیرفعال یا عادی نکند — قفل کامل بیرون. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiAdmin();
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const existing = await prisma.coreUser.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'کاربر یافت نشد.' }, { status: 404 });
  }

  let body: UserPatchBody;
  try {
    body = (await request.json()) as UserPatchBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const isSelf = existing.id === session.sub;
  // نقش جدید باید موجود باشد؛ وگرنه نقش فعلی حفظ می‌شود.
  const requestedRole = typeof body.role === 'string' && body.role.trim() ? body.role.trim() : existing.role;
  const nextRole = requestedRole === existing.role ? existing.role
    : (await prisma.coreRole.findUnique({ where: { name: requestedRole } }))
      ? requestedRole
      : existing.role;
  const nextActive = body.isActive === undefined ? existing.isActive : body.isActive !== false;
  const nextIsAdmin = (await resolveCoreRole(nextRole))?.isAdmin ?? false;
  if (isSelf && (!nextIsAdmin || !nextActive)) {
    return NextResponse.json(
      { error: 'نمی‌توانید دسترسی یا وضعیت حساب خودتان را کم کنید.' },
      { status: 400 }
    );
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (password && password.length < 8) {
    return NextResponse.json({ error: 'رمز عبور حداقل ۸ نویسه باشد.' }, { status: 400 });
  }

  // salt یک بار تولید می‌شود و همان در hash می‌نشیند.
  const salt = password ? makeSalt() : existing.salt;

  await prisma.coreUser.update({
    where: { id },
    data: {
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.name,
      role: nextRole,
      isActive: nextActive,
      ...(password ? { salt, passwordHash: hashPassword(password, salt) } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/users/[id] — حذف کاربر (مدیر کل؛ نه خودش). */
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiAdmin();
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  if (id === session.sub) {
    return NextResponse.json({ error: 'حساب خودتان را نمی‌توانید حذف کنید.' }, { status: 400 });
  }
  const existing = await prisma.coreUser.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'کاربر یافت نشد.' }, { status: 404 });
  }

  await prisma.coreUser.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
