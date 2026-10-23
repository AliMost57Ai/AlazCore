import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { fromFaDigits } from '@/lib/format';
import { getSiteSettings, saveSiteSettings, type SiteSettings } from '@/lib/theme-settings';

interface SiteBody {
  siteName?: unknown;
  siteUrl?: unknown;
  contactPhone?: unknown;
  contactEmail?: unknown;
  contactAddress?: unknown;
  aboutUs?: unknown;
  enamadPath?: unknown;
  mediaPath?: unknown;
  enamadUrl?: unknown;
  mediaUrl?: unknown;
  logoPath?: unknown;
  faviconPath?: unknown;
}

/** Uploaded asset paths look like 'uploads/<random>.<ext>' — nothing else. */
const UPLOAD_PATH_PATTERN = /^uploads\/[A-Za-z0-9._-]{1,120}$/;

/** Current site identity settings — admin only. */
export async function GET() {
  const session = await requireApiMenu('/settings/site');
  if (session instanceof NextResponse) {
    return session;
  }

  return NextResponse.json({ settings: await getSiteSettings() });
}

/**
 * Persists site identity settings — needs the site:edit grant. Absent fields
 * are left untouched (each settings sub-page submits only its own form).
 */
export async function PUT(request: NextRequest) {
  const session = await requireApiMenu('/settings/site', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  let body: SiteBody;
  try {
    body = (await request.json()) as SiteBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const input: Partial<SiteSettings> = {};
  const invalid = (message: string): NextResponse =>
    NextResponse.json({ error: message }, { status: 400 });

  if (typeof body.siteName === 'string') {
    if (body.siteName.length > 60) {
      return invalid('نام سایت نمی‌تواند بیشتر از ۶۰ نویسه باشد.');
    }
    input.siteName = body.siteName;
  }
  if (typeof body.siteUrl === 'string') {
    const url = body.siteUrl.trim();
    if (url !== '' && !/^https?:\/\/.{3,200}$/.test(url)) {
      return invalid('نشانی سایت باید با http:// یا https:// شروع شود.');
    }
    input.siteUrl = url;
  }
  if (typeof body.contactPhone === 'string') {
    const phone = fromFaDigits(body.contactPhone).replace(/\s/g, '');
    if (phone !== '' && !/^09\d{9}$/.test(phone)) {
      return invalid('شماره تماس باید با ۰۹ شروع شود و ۱۱ رقم باشد.');
    }
    input.contactPhone = phone;
  }
  if (typeof body.contactEmail === 'string') {
    const email = body.contactEmail.trim();
    if (email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return invalid('نشانی ایمیل معتبر نیست.');
    }
    if (email.length > 120) {
      return invalid('نشانی ایمیل نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.');
    }
    input.contactEmail = email;
  }
  if (typeof body.contactAddress === 'string') {
    if (body.contactAddress.length > 300) {
      return invalid('نشانی نمی‌تواند بیشتر از ۳۰۰ نویسه باشد.');
    }
    input.contactAddress = body.contactAddress;
  }
  if (typeof body.aboutUs === 'string') {
    if (body.aboutUs.length > 4000) {
      return invalid('متن درباره ما نمی‌تواند بیشتر از ۴۰۰۰ نویسه باشد.');
    }
    input.aboutUs = body.aboutUs;
  }
  for (const [key, value] of [
    ['enamadUrl', body.enamadUrl],
    ['mediaUrl', body.mediaUrl],
  ] as const) {
    if (typeof value === 'string') {
      const url = value.trim();
      if (url !== '' && !/^https?:\/\/.{3,200}$/.test(url)) {
        return invalid('نشانی نشان (اینماد/رسانه) باید با http:// یا https:// شروع شود.');
      }
      input[key] = url;
    }
  }
  for (const [key, value] of [
    ['enamadPath', body.enamadPath],
    ['mediaPath', body.mediaPath],
    ['logoPath', body.logoPath],
    ['faviconPath', body.faviconPath],
  ] as const) {
    if (typeof value === 'string') {
      const path = value.trim();
      if (path !== '' && !UPLOAD_PATH_PATTERN.test(path)) {
        return invalid('مسیر فایل آپلودشده معتبر نیست.');
      }
      input[key] = path;
    }
  }

  const settings = await saveSiteSettings(input);
  return NextResponse.json({ ok: true, settings });
}
