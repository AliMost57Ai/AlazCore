import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { currentRequestDomain, enterSiteContext } from '@/lib/site-context';
import { saveSupportImage, saveUploadedImage } from '@/lib/upload-image';

/**
 * POST /api/account/returns/upload — تصاویر درخواست مرجوعی مشتری (علت
 * مرجوعی) و عکس رسید مرسوله. الگوی /api/upload با گارد کاربر عادی؛
 * اعتبارسنجی مشترک در lib/upload-image.ts.
 *
 * kind=shipping (عکس رسید مرسوله در مرحلهٔ «ثبت مدارک ارسال») قواعد
 * سخت‌گیرانهٔ تصویر پشتیبانی را دارد: فقط JPG/PNG و حداکثر ۲۰۰ کیلوبایت.
 * عکس‌های علت مرجوعی همان سقف عمومی ۵ مگابایتی را دارند.
 */
export async function POST(request: NextRequest) {
  // enter در فریم خود handler — وگرنه فایل به‌جای دیر سایت در data/ اصلی می‌نشیند.
  enterSiteContext(await currentRequestDomain());
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
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

  const saved =
    form.get('kind') === 'shipping' ? await saveSupportImage(file) : await saveUploadedImage(file);
  if ('error' in saved) {
    return NextResponse.json({ error: saved.error }, { status: 400 });
  }

  return NextResponse.json({ path: saved.path }, { status: 201 });
}
