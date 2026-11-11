import { NextResponse, type NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { currentRequestDomain, enterSiteContext } from '@/lib/site-context';
import { activeDataDir } from '@/lib/site-db';

/**
 * GET /api/files/:path… — serves uploaded files from data/.
 *
 * Reads are unauthenticated: product images are shown on the same authed pages
 * and carry the same trust level as the demo data. Path safety is still
 * enforced — the resolved absolute path must stay inside data/, otherwise the
 * route could be used to read any file on the disk (e.g. /api/files/../../.env).
 */

/** ریشه‌ی داده — با کانتکست سایت، data/sites/{دامنه} تا فایل‌های سایت‌ها
 *  قاطی نشوند؛ بدون کانتکست (main db) همان data/. */
function dataDir(): string {
  // ریشه‌ی داده فقط در زمان اجرا مشخص می‌شود و فایل‌هایش جزء بیلد نیستند؛
  // بدون turbopackIgnore، Turbopack کل پروژه را trace و در خروجی سرور کپی می‌کند.
  return path.join(/*turbopackIgnore: true*/ process.cwd(), activeDataDir());
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  // enter در فریم خودِ handler — با ensureSiteContext (enterWith داخل هلپر)
  // کانتکست به این زنجیره نمی‌رسید و activeDataDir همیشه data/ اصلی بود.
  enterSiteContext(await currentRequestDomain());
  const { path: segments } = await params;

  // Rebuild and resolve, then verify the result is still inside the data root.
  const relative = segments.map((segment) => decodeURIComponent(segment)).join('/');
  const DATA_DIR = dataDir();
  const absolute = path.resolve(/*turbopackIgnore: true*/ DATA_DIR, relative);

  const isInsideData =
    absolute === DATA_DIR || (absolute.startsWith(DATA_DIR + path.sep) && !relative.includes('..'));

  if (!isInsideData) {
    return NextResponse.json({ error: 'مسیر نامعتبر است.' }, { status: 400 });
  }

  const ext = path.extname(absolute).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    return NextResponse.json({ error: 'نوع فایل پشتیبانی نمی‌شود.' }, { status: 400 });
  }

  try {
    const file = await readFile(absolute);
    // Uploaded filenames are UUIDs, so content is immutable per URL.
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'فایل یافت نشد.' }, { status: 404 });
  }
}
