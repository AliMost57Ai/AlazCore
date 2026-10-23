import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireApiMenu } from '@/lib/auth';

interface PlanBody {
  name?: unknown;
  description?: unknown;
  menus?: unknown;
  limits?: unknown;
  isActive?: unknown;
  durationDays?: unknown;
  priceMonthly?: unknown;
}

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value.trim() : fallback;

function toPlanInput(body: PlanBody) {
  return {
    name: str(body.name),
    description: str(body.description),
    menus: JSON.stringify(Array.isArray(body.menus) ? body.menus.map(String) : []),
    limits: JSON.stringify(
      body.limits && typeof body.limits === 'object' && !Array.isArray(body.limits)
        ? body.limits
        : {}
    ),
    isActive: body.isActive !== false,
    durationDays:
      typeof body.durationDays === 'number' && body.durationDays > 0
        ? Math.floor(body.durationDays)
        : null,
    priceMonthly:
      typeof body.priceMonthly === 'number' && body.priceMonthly >= 0
        ? Math.floor(body.priceMonthly)
        : 0,
  };
}

/** GET /api/plans — فهرست پلن‌ها با شمار دامین‌های متصل. */
export async function GET() {
  const session = await requireApiMenu('/panel/plans');
  if (session instanceof Response) {
    return session;
  }

  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { domains: true, assignments: true } } },
  });
  return NextResponse.json({
    plans: plans.map((plan) => ({
      ...plan,
      menus: safeParseArray(plan.menus),
      limits: safeParseObject(plan.limits),
    })),
  });
}

/** POST /api/plans — تعریف پلن جدید (فقط مدیر کل). */
export async function POST(request: NextRequest) {
  const session = await requireApiMenu('/panel/plans', 'add');
  if (session instanceof Response) {
    return session;
  }

  let body: PlanBody;
  try {
    body = (await request.json()) as PlanBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const input = toPlanInput(body);
  if (!input.name) {
    return NextResponse.json({ error: 'نام پلن الزامی است.' }, { status: 400 });
  }

  const plan = await prisma.plan.create({ data: input });
  return NextResponse.json({ id: plan.id }, { status: 201 });
}

function safeParseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function safeParseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
