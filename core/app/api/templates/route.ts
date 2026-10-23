import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireApiMenu } from '@/lib/auth';

interface TemplateBody {
  key?: unknown;
  name?: unknown;
  description?: unknown;
  isActive?: unknown;
  isDefault?: unknown;
}

const KEY_PATTERN = /^[a-z][a-z0-9-]*$/;

/** GET /api/templates — فهرست تم‌ها با شمار سایت‌های مصرف‌کننده. */
export async function GET() {
  const session = await requireApiMenu('/panel/templates');
  if (session instanceof Response) {
    return session;
  }

  const templates = await prisma.template.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: { _count: { select: { domains: true } } },
  });
  return NextResponse.json({ templates });
}

/** POST /api/templates — تعریف تم جدید (فقط مدیر کل). */
export async function POST(request: NextRequest) {
  const session = await requireApiMenu('/panel/templates', 'add');
  if (session instanceof Response) {
    return session;
  }

  let body: TemplateBody;
  try {
    body = (await request.json()) as TemplateBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const key = typeof body.key === 'string' ? body.key.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!KEY_PATTERN.test(key)) {
    return NextResponse.json(
      { error: 'کلید تم باید با حرف لاتین شروع شود و فقط شامل a-z، رقم و خط تیره باشد.' },
      { status: 400 }
    );
  }
  if (!name) {
    return NextResponse.json({ error: 'نام تم الزامی است.' }, { status: 400 });
  }

  const duplicate = await prisma.template.findUnique({ where: { key } });
  if (duplicate) {
    return NextResponse.json({ error: 'این کلید تم قبلاً ثبت شده است.' }, { status: 400 });
  }

  const template = await prisma.template.create({
    data: {
      key,
      name,
      description: typeof body.description === 'string' ? body.description.trim() : '',
      isActive: body.isActive !== false,
      isDefault: false,
    },
  });
  return NextResponse.json({ id: template.id }, { status: 201 });
}
