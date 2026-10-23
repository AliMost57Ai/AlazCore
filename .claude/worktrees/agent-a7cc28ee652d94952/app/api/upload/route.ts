import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requireApiMenu } from '@/lib/api-auth';

/** Where uploaded files land — data/uploads, outside public/ (build-time only). */
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

const MAX_BYTES = 5 * 1024 * 1024;

/** Primary magic bytes per format. webp/avif get a second check below. */
const ALLOWED_TYPES: { ext: string; mime: string; magic: number[] }[] = [
  { ext: 'png', mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: 'jpg', mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  // 'RIFF' — a webp continues with 'WEBP' at offset 8.
  { ext: 'webp', mime: 'image/webp', magic: [0x52, 0x49, 0x46, 0x46] },
  // ISO-BMFF box size — an avif continues with 'ftyp' at offset 4.
  { ext: 'avif', mime: 'image/avif', magic: [0x00, 0x00, 0x00, 0x20] },
];

/**
 * POST /api/upload — product images, multipart/form-data with a `file` field.
 * Serves both creating and editing products, so either grant unlocks it.
 *
 * The client filename is never trusted: files are stored under a random UUID
 * name (no path traversal, no overwrite), and the type check sniffs magic
 * bytes, not the declared mime — a renamed .exe is rejected.
 */
export async function POST(request: NextRequest) {
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

  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'حجم تصویر باید بین ۱ بایت و ۵ مگابایت باشد.' },
      { status: 400 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Magic-byte sniffing: find the first allowed type whose signature matches.
  const matched = ALLOWED_TYPES.find(
    (type) => type.magic.length <= bytes.length && type.magic.every((byte, i) => bytes[i] === byte)
  );

  // webp: RIFF header + 'WEBP' at offset 8. avif: 'ftyp' box at offset 4.
  const isWebp =
    matched?.ext === 'webp' &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  const isAvif =
    matched?.ext === 'avif' &&
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70;

  let type = matched;
  if (matched?.ext === 'webp' && !isWebp) {
    type = undefined;
  }
  if (matched?.ext === 'avif' && !isAvif) {
    type = undefined;
  }

  if (!type) {
    return NextResponse.json(
      { error: 'فقط تصاویر PNG، JPG، WebP و AVIF پذیرفته می‌شوند.' },
      { status: 400 }
    );
  }

  const filename = `${randomUUID()}.${type.ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);

  return NextResponse.json({ path: `uploads/${filename}` }, { status: 201 });
}
