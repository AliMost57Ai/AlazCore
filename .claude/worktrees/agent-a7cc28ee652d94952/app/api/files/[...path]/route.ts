import { NextResponse, type NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * GET /api/files/:path… — serves uploaded files from data/.
 *
 * Reads are unauthenticated: product images are shown on the same authed pages
 * and carry the same trust level as the demo data. Path safety is still
 * enforced — the resolved absolute path must stay inside data/, otherwise the
 * route could be used to read any file on the disk (e.g. /api/files/../../.env).
 */

const DATA_DIR = path.join(process.cwd(), 'data');

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
  const { path: segments } = await params;

  // Rebuild and resolve, then verify the result is still inside data/.
  const relative = segments.map((segment) => decodeURIComponent(segment)).join('/');
  const absolute = path.resolve(DATA_DIR, relative);

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
