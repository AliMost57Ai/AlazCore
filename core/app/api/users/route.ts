import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, makeSalt, requireApiAdmin } from '@/lib/auth';

interface UserBody {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  password?: unknown;
  isActive?: unknown;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** GET /api/users — فهرست کاربران پنل Core (فقط مدیر کل). */
export async function GET() {
  const session = await requireApiAdmin();
  if (session instanceof Response) {
    return session;
  }

  const users = await prisma.coreUser.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

/** POST /api/users — ساخت کاربر پنل (فقط مدیر کل). */
export async function POST(request: NextRequest) {
  const session = await requireApiAdmin();
  if (session instanceof Response) {
    return session;
  }

  let body: UserBody;
  try {
    body = (await request.json()) as UserBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  // نقش باید در جدول نقش‌ها موجود باشد — همان قاعده فروشگاه.
  const role = typeof body.role === 'string' ? body.role.trim() : 'support';
  const roleExists = await prisma.coreRole.findUnique({ where: { name: role } });
  if (!roleExists) {
    return NextResponse.json({ error: 'نقش انتخابی وجود ندارد.' }, { status: 400 });
  }

  if (!name || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: 'نام و ایمیل معتبر الزامی است.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'رمز عبور حداقل ۸ نویسه باشد.' }, { status: 400 });
  }

  const duplicate = await prisma.coreUser.findUnique({ where: { email } });
  if (duplicate) {
    return NextResponse.json({ error: 'این ایمیل قبلاً ثبت شده است.' }, { status: 400 });
  }

  const salt = makeSalt();
  const user = await prisma.coreUser.create({
    data: {
      name,
      email,
      role,
      salt,
      passwordHash: hashPassword(password, salt),
      isActive: body.isActive !== false,
    },
    select: { id: true },
  });
  return NextResponse.json({ id: user.id }, { status: 201 });
}
