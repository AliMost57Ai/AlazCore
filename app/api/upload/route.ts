import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { currentRequestDomain, enterSiteContext } from '@/lib/site-context';
import { saveUploadedImage } from '@/lib/upload-image';

/**
 * POST /api/upload — product images, multipart/form-data with a `file` field.
 * Serves both creating and editing products, so either grant unlocks it.
 *
 * Validation and storage live in lib/upload-image.ts (shared with the
 * customer-side return-request upload): the client filename is never trusted,
 * files are stored under a random UUID name, and the type check sniffs magic
 * bytes, not the declared mime — a renamed .exe is rejected.
 */
export async function POST(request: NextRequest) {
  // enter در فریم خود handler — وگرنه فایل به‌جای دیر سایت در data/ اصلی می‌نشیند.
  enterSiteContext(await currentRequestDomain());
  const session = await requireApiMenu('/products', ['add', 'edit']);
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

  const saved = await saveUploadedImage(file);
  if ('error' in saved) {
    return NextResponse.json({ error: saved.error }, { status: 400 });
  }

  return NextResponse.json({ path: saved.path }, { status: 201 });
}
