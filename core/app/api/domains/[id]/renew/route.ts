import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/auth';
import prisma from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

interface RenewBody {
  /** 'plan' = تمدید به اندازه مدت پلن؛ 'date' = تا تاریخ انتخاب کارشناس. */
  mode?: unknown;
  /** yyyy-mm-dd — فقط برای mode 'date'. */
  expiresAt?: unknown;
}

/**
 * POST /api/domains/[id]/renew — تمدید اعتبار پلن دامنه (کارشناس دامنه).
 *
 *  - mode 'plan': از بیشینه (الان، انقضای فعلی) به اندازه plan.durationDays.
 *  - mode 'date': انقضا تا تاریخ انتخابی کارشناس.
 * هر تمدید یک ردیف PlanAssignment (سابقه) ثبت می‌کند و دامنه را از
 * غیرفعال/تعلیق پشتیبانی خارج می‌کند (isActive=true، status='active').
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  const session = await requireApiMenu('/panel/domains', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  let body: RenewBody;
  try {
    body = (await request.json()) as RenewBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const domain = await prisma.domain.findUnique({ where: { id }, include: { plan: true } });
  if (!domain) {
    return NextResponse.json({ error: 'دامنه یافت نشد.' }, { status: 404 });
  }

  const now = new Date();
  const currentEnd =
    domain.planExpiresAt && domain.planExpiresAt > now ? domain.planExpiresAt : now;

  let newEnd: Date;
  if (body.mode === 'date') {
    if (typeof body.expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.expiresAt)) {
      return NextResponse.json({ error: 'تاریخ تمدید معتبر نیست.' }, { status: 400 });
    }
    newEnd = new Date(`${body.expiresAt}T23:59:59.999`);
    if (Number.isNaN(newEnd.getTime())) {
      return NextResponse.json({ error: 'تاریخ تمدید معتبر نیست.' }, { status: 400 });
    }
    if (newEnd <= now) {
      return NextResponse.json({ error: 'تاریخ تمدید باید در آینده باشد.' }, { status: 400 });
    }
  } else {
    if (!domain.plan || !domain.plan.isActive) {
      return NextResponse.json(
        { error: 'این دامنه پلن فعالی ندارد — ابتدا پلن را انتخاب کنید یا تاریخ مشخص کنید.' },
        { status: 400 }
      );
    }
    const days = domain.plan.durationDays;
    if (!days || days < 1) {
      return NextResponse.json(
        { error: 'مدت اعتبار پلن تعریف نشده است — تاریخ را دستی انتخاب کنید.' },
        { status: 400 }
      );
    }
    newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);
  }

  // سوابق: بستن تخصیص جاری (در صورت باز بودن) و ثبت دوره تمدید به‌عنوان
  // ردیف جدید — تاریخچه کامل تمدیدها در PlanAssignment می‌ماند. دامنه بدون
  // پلن فقط تاریخ انقضا را می‌گیرد (سابقه‌ای برای ثبت ندارد).
  await prisma.planAssignment.updateMany({
    where: { domainId: id, endsAt: null },
    data: { endsAt: currentEnd },
  });
  const assignment =
    domain.planId && domain.plan
      ? await prisma.planAssignment.create({
          data: { domainId: id, planId: domain.planId, startsAt: currentEnd, endsAt: newEnd },
        })
      : null;
  await prisma.domain.update({
    where: { id },
    data: {
      planExpiresAt: newEnd,
      isActive: true,
      status: 'active',
      lastRenewalAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    planExpiresAt: newEnd.toISOString(),
    startsAt: (assignment?.startsAt ?? currentEnd).toISOString(),
  });
}
