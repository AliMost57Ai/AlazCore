import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import prisma from '@/lib/db';
import { requireApiAdmin } from '@/lib/auth';
import { resolveApiKey } from '@/lib/licensing';

/** GET /api/settings — تنظیمات سامانه (کلید API و وضعیت آن). */
export async function GET() {
  const session = await requireApiAdmin();
  if (session instanceof Response) {
    return session;
  }

  const apiKey = await resolveApiKey();
  return NextResponse.json({
    apiKeyFromEnv: Boolean(process.env.CORE_API_KEY),
    apiKey,
  });
}

interface SettingsBody {
  action?: unknown;
}

/** POST /api/settings — بازتولید کلید API اعتبارسنجی (فقط مدیر کل). */
export async function POST(request: NextRequest) {
  const session = await requireApiAdmin();
  if (session instanceof Response) {
    return session;
  }

  let body: SettingsBody;
  try {
    body = (await request.json()) as SettingsBody;
  } catch {
    body = {};
  }

  if (body.action !== 'regenerateApiKey') {
    return NextResponse.json({ error: 'عملیات ناشناخته.' }, { status: 400 });
  }
  if (process.env.CORE_API_KEY) {
    return NextResponse.json(
      { error: 'کلید API از متغیر محیطی CORE_API_KEY تزریق شده؛ برای تغییر آن را ویرایش کنید.' },
      { status: 400 }
    );
  }

  const apiKey = `ak_${randomBytes(24).toString('hex')}`;
  const existing = await prisma.coreSetting.findUnique({ where: { key: 'api_key' } });
  if (existing) {
    await prisma.coreSetting.update({ where: { key: 'api_key' }, data: { value: apiKey } });
  } else {
    await prisma.coreSetting.create({ data: { key: 'api_key', value: apiKey } });
  }
  return NextResponse.json({ apiKey });
}
