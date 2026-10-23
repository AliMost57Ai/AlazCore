import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';

const KEY = 'newsletter_emails';
const MAX_SUBSCRIBERS = 10_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Public newsletter signup (the storefront's خبرنامه section). No session —
 * the storefront is public; the address itself is the payload. Stored as a
 * JSON array in AppConfig (SQLite has no Json column); duplicates and the
 * cap keep the list sane.
 */
export async function POST(request: NextRequest) {
  let email = '';
  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'ایمیل وارد شده معتبر نیست.' }, { status: 400 });
  }

  const existing = await prisma.appConfig.findUnique({ where: { key: KEY } });
  let list: string[] = [];
  if (existing) {
    try {
      const parsed: unknown = JSON.parse(existing.value);
      if (Array.isArray(parsed)) {
        list = parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      list = [];
    }
  }

  if (list.includes(email)) {
    return NextResponse.json({ ok: true, already: true });
  }
  if (list.length >= MAX_SUBSCRIBERS) {
    return NextResponse.json({ error: 'ظرفیت خبرنامه تکمیل است.' }, { status: 400 });
  }

  list.push(email);
  await prisma.appConfig.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(list) },
    update: { value: JSON.stringify(list) },
  });

  return NextResponse.json({ ok: true });
}
