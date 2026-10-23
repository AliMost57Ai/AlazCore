/**
 * لوگوهای کاتالوگ (درگاه/پیامک) — ذخیره در core/data/uploads و سرو با
 * /api/catalog/logo/[kind]/[id]. فقط png/jpg/webp/svg تا ۲ مگابایت.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');
const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED: { ext: string; mime: string; magic: number[] }[] = [
  { ext: 'png', mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: 'jpg', mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { ext: 'webp', mime: 'image/webp', magic: [0x52, 0x49, 0x46, 0x46] },
  { ext: 'svg', mime: 'image/svg+xml', magic: [0x3c, 0x3f, 0x78, 0x6d] }, // '<?xm'
];

export function detectImageType(bytes: Uint8Array): { ext: string; mime: string } | null {
  for (const candidate of ALLOWED) {
    if (candidate.magic.every((byte, index) => bytes[index] === byte)) {
      return { ext: candidate.ext, mime: candidate.mime };
    }
  }
  return null;
}

/** ذخیره لوگو و برگرداندن مسیر نسبی برای ستون logoPath؛ نامعتبر = null. */
export async function saveCatalogLogo(
  kind: 'gateways' | 'sms',
  id: string,
  bytes: Uint8Array
): Promise<string | null> {
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return null;
  }
  const type = detectImageType(bytes);
  if (!type) {
    return null;
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${kind}-${id}-${randomUUID().slice(0, 8)}.${type.ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);
  return `uploads/${filename}`;
}

/** مسیر مطلق فایل از روی مسیر نسبی DB — فقط داخل uploads مجاز. */
export function resolveCatalogLogoFile(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, '/');
  if (!normalized.startsWith('uploads/') || normalized.includes('..')) {
    return null;
  }
  return path.join(UPLOAD_DIR, normalized.slice('uploads/'.length));
}

export function logoMime(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED.find((candidate) => `.${candidate.ext}` === ext)?.mime ?? 'application/octet-stream';
}
