import { NextResponse, type NextRequest } from 'next/server';
import { getAppSettings } from '@/lib/settings';
import { currentRequestDomain, enterSiteContext } from '@/lib/site-context';
import { requireSupportViewer, supportDisabled } from '@/lib/support-viewer';
import { saveSupportImage } from '@/lib/upload-image';

/**
 * POST /api/support/upload — تصویر پیوست تیکت پشتیبانی (JPG/PNG، حداکثر
 * ۲۰۰ کیلوبایت — اعتبارسنجی مشترک saveSupportImage: جادوی بایت‌ها، هرگز
 * mime ادعاشده).
 *
 * گارد همان گفتگو است: مشتری واردشده یا مهمانِ دارای کوکی mnt_support (و
 * پشتیبان برای پاسخ). پشتیبانی خاموش = مسیر مشتری/مهمان بسته؛ پنل باز.
 * خروجی مسیر نسبی زیر uploads/ است که فقط با POST پیام و sanitize سمت سرور
 * روی رکورد می‌نشیند.
 */
export async function POST(request: NextRequest) {
  // enter در فریم خود handler — وگرنه فایل به‌جای دیر سایت در data/ اصلی می‌نشیند.
  enterSiteContext(await currentRequestDomain());
  const viewer = await requireSupportViewer();
  if (viewer instanceof NextResponse) {
    return viewer;
  }

  if (viewer.kind !== 'staff') {
    const settings = await getAppSettings();
    if (!settings.supportEnabled) {
      return supportDisabled();
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'فایلی ارسال نشده است.' }, { status: 400 });
  }

  const saved = await saveSupportImage(file);
  if ('error' in saved) {
    return NextResponse.json({ error: saved.error }, { status: 400 });
  }

  return NextResponse.json({ path: saved.path }, { status: 201 });
}
