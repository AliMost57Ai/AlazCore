/**
 * Shared image-upload validation/storage for the /api/upload-style routes:
 * size cap, magic-byte sniffing (the declared mime is never trusted) and a
 * random UUID filename under the ACTIVE site's data/uploads directory.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { activeDataDir } from '@/lib/site-db';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** سقف عکس تیکت پشتیبانی — ۲۰۰ کیلوبایت. */
export const MAX_SUPPORT_IMAGE_BYTES = 200 * 1024;

/** Primary magic bytes per format. webp/avif get a second check below. */
const ALLOWED_TYPES: { ext: string; mime: string; magic: number[] }[] = [
  { ext: 'png', mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: 'jpg', mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  // 'RIFF' — a webp continues with 'WEBP' at offset 8.
  { ext: 'webp', mime: 'image/webp', magic: [0x52, 0x49, 0x46, 0x46] },
  // ISO-BMFF box size — an avif continues with 'ftyp' at offset 4.
  { ext: 'avif', mime: 'image/avif', magic: [0x00, 0x00, 0x00, 0x20] },
];

/** Where uploaded files land — data/uploads of the ACTIVE site, outside public/. */
function uploadDir(): string {
  return path.join(process.cwd(), activeDataDir(), 'uploads');
}

export type SaveImageResult = { ok: true; path: string } | { error: string };

/**
 * Validates and stores one uploaded image; the returned path is relative to
 * data/ and served by GET /api/files/:path…
 */
export async function saveUploadedImage(file: File): Promise<SaveImageResult> {
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return { error: 'حجم تصویر باید بین ۱ بایت و ۵ مگابایت باشد.' };
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
    return { error: 'فقط تصاویر PNG، JPG، WebP و AVIF پذیرفته می‌شوند.' };
  }

  const filename = `${randomUUID()}.${type.ext}`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), filename), bytes);

  return { ok: true, path: `uploads/${filename}` };
}

/**
 * Validates and stores one support-ticket image — قواعد سخت‌گیرانه‌تر از آپلود
 * عمومی: فقط JPG/PNG و حداکثر ۲۰۰ کیلوبایت. مسیر برگشتی نسبی به data/ است و
 * GET /api/files/:path… سروش می‌دهد.
 */
export async function saveSupportImage(file: File): Promise<SaveImageResult> {
  if (file.size === 0 || file.size > MAX_SUPPORT_IMAGE_BYTES) {
    return { error: 'حجم تصویر باید بین ۱ بایت و ۲۰۰ کیلوبایت باشد.' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const isPng = bytes.length >= 4 && ALLOWED_TYPES[0].magic.every((byte, i) => bytes[i] === byte);
  const isJpg = bytes.length >= 3 && ALLOWED_TYPES[1].magic.every((byte, i) => bytes[i] === byte);

  if (!isPng && !isJpg) {
    return { error: 'فقط تصاویر JPG و PNG پذیرفته می‌شوند.' };
  }

  const filename = `${randomUUID()}.${isPng ? 'png' : 'jpg'}`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), filename), bytes);

  return { ok: true, path: `uploads/${filename}` };
}
