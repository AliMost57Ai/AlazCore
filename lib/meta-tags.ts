/**
 * Admin-managed third-party "meta code" slots (Batch K point 2) — Google
 * Analytics, Tag Manager, Search Console verification, Clarity, and a
 * strictly-limited custom meta-tag slot.
 *
 * SECURITY MODEL: nothing the admin types is ever injected as raw HTML.
 * Each slot kind has its own validator that extracts a strict identifier
 * (measurement ID, GTM container ID, content string…) and the renderer
 * builds the exact tag from that value. The admin's free-text is treated
 * as data, never as markup:
 *
 *   ga4    → G-XXXX… / UA-…      → <script src googletagmanager.com/gtag/js>
 *   gtm    → GTM-XXXX…           → <script> GTM bootstrap
 *   gsc    → content token       → <meta name="google-site-verification">
 *   clarity→ XXXXXXXXXX project  → <script> clarity bootstrap
 *   custom → one <meta> tag      → name/property + content, both
 *                                   sanitized to a safe charset (no quotes,
 *                                   no angle brackets, no javascript: URLs)
 *
 * Anything that fails validation is rejected with a Persian message at the
 * API boundary and never stored. renderMetaTagHtml is the only place HTML
 * strings are produced, and it only interpolates values that already passed
 * the kind's pattern — so a malicious payload cannot reach the DOM.
 *
 * MetaTag rows are active-scoped: listMetaTagsForHead returns the ready
 * HTML for every active slot, used by the storefront page head.
 */

import prisma from './db';
import { META_TAG_KIND_MAP, META_TAG_KINDS, type MetaTagKind } from './meta-tag-defs';

export {
  META_TAG_KIND_MAP,
  META_TAG_KINDS,
  type MetaTagKind,
  type MetaTagKindDef,
} from './meta-tag-defs';

export interface MetaTagDTO {
  id: string;
  kind: MetaTagKind;
  kindLabel: string;
  title: string;
  content: string;
  isActive: boolean;
}

/** --- custom slot parsing ----------------------------------------------- */

export interface CustomMetaParts {
  name: string;
  content: string;
}

/**
 * Parses the custom slot's «name=…|content=…» value into its two parts.
 * Returns null when the shape is wrong (the route rejects with the kind's
 * Persian error).
 */
export function parseCustomMeta(content: string): CustomMetaParts | null {
  const match = /^(?:name|property)=([^|]+)\|content=(.+)$/.exec(content.trim());
  if (!match) {
    return null;
  }
  return { name: match[1].trim(), content: match[2].trim() };
}

/**
 * Neutralizes a custom-slot attribute value: the dangerous characters for
 * an HTML attribute context (< > " ' ` and control chars) are stripped so
 * the value can never break out of the quoted attribute the renderer emits.
 */
export function sanitizeCustomMetaValue(value: string): string {
  return (
    value
      .replace(/[<>"'`\\]/g, '')
      // eslint-disable-next-line no-control-regex -- stripping control chars is the point
      .replace(/[\x00-\x1f]/g, '')
      .trim()
  );
}

/** --- rendering ----------------------------------------------------------- */

/**
 * Builds the exact HTML for one slot. `content` must have passed its kind's
 * pattern beforehand (storeSlot/listMetaTagsForHead guarantee that; the
 * stored rows are re-validated at read time as defense in depth).
 */
export function renderMetaTagHtml(kind: MetaTagKind, content: string): string {
  switch (kind) {
    case 'ga4':
      return `<script async src="https://www.googletagmanager.com/gtag/js?id=${content}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${content}');</script>`;
    case 'gtm':
      return `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer','${content}');</script>`;
    case 'gsc':
      return `<meta name="google-site-verification" content="${content}">`;
    case 'clarity':
      return `<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${content}");</script>`;
    case 'custom': {
      const parts = parseCustomMeta(content);
      if (!parts) {
        return '';
      }
      const name = sanitizeCustomMetaValue(parts.name);
      const value = sanitizeCustomMetaValue(parts.content);
      return `<meta name="${name}" content="${value}">`;
    }
  }
}

/** --- persistence ---------------------------------------------------------- */

function toDTO(row: {
  id: string;
  kind: string;
  title: string;
  content: string;
  isActive: boolean;
}): MetaTagDTO {
  const kind = (
    META_TAG_KINDS.some((def) => def.kind === row.kind) ? row.kind : 'custom'
  ) as MetaTagKind;
  return {
    id: row.id,
    kind,
    kindLabel: META_TAG_KIND_MAP[kind].label,
    title: row.title,
    content: row.content,
    isActive: row.isActive,
  };
}

/** All configured slots (admin list) — ordered by sortOrder then creation. */
export async function listMetaTags(): Promise<MetaTagDTO[]> {
  const rows = await prisma.metaTag.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toDTO);
}

export interface HeadMetaTag {
  id: string;
  html: string;
}

/**
 * The active slots as ready-to-inject HTML — each stored content is
 * re-validated against its kind's pattern before rendering, so a corrupted
 * row can never leak markup.
 */
export async function listMetaTagsForHead(): Promise<HeadMetaTag[]> {
  const rows = await prisma.metaTag.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows
    .map(toDTO)
    .filter((tag) => META_TAG_KIND_MAP[tag.kind].pattern.test(tag.content))
    .map((tag) => ({ id: tag.id, html: renderMetaTagHtml(tag.kind, tag.content) }));
}

export interface SaveMetaTagInput {
  kind?: unknown;
  title?: unknown;
  content?: unknown;
  isActive?: unknown;
}

/**
 * Creates or updates one slot after full validation. Returns the saved DTO,
 * or a Persian error string — the route maps it to HTTP 400.
 */
export async function saveMetaTag(
  id: string | null,
  input: SaveMetaTagInput
): Promise<{ tag: MetaTagDTO } | { error: string }> {
  if (input.kind !== undefined && typeof input.kind !== 'string') {
    return { error: 'نوع کد متا نامعتبر است.' };
  }
  const kindDef =
    input.kind === undefined ? null : META_TAG_KINDS.find((def) => def.kind === input.kind);
  if (input.kind !== undefined && !kindDef) {
    return { error: 'نوع کد متا پشتیبانی نمی‌شود.' };
  }

  if (input.title !== undefined) {
    if (typeof input.title !== 'string' || input.title.trim().length === 0) {
      return { error: 'عنوان کد متا نمی‌تواند خالی باشد.' };
    }
    if (input.title.length > 80) {
      return { error: 'عنوان کد متا نمی‌تواند بیشتر از ۸۰ نویسه باشد.' };
    }
  }

  // Determine the effective kind for content validation.
  let effectiveKind: MetaTagKind;
  if (kindDef) {
    effectiveKind = kindDef.kind;
  } else if (id) {
    const row = await prisma.metaTag.findUnique({ where: { id } });
    if (!row) {
      return { error: 'کد متا یافت نشد.' };
    }
    effectiveKind = toDTO(row).kind;
  } else {
    return { error: 'نوع کد متا الزامی است.' };
  }

  if (input.content !== undefined) {
    if (typeof input.content !== 'string') {
      return { error: 'محتوای کد متا نامعتبر است.' };
    }
    const content = input.content.trim();
    if (!META_TAG_KIND_MAP[effectiveKind].pattern.test(content)) {
      return { error: META_TAG_KIND_MAP[effectiveKind].error };
    }
    // Custom slots are additionally parsed to a valid name/content pair.
    if (effectiveKind === 'custom' && !parseCustomMeta(content)) {
      return { error: META_TAG_KIND_MAP.custom.error };
    }
  }

  if (input.isActive !== undefined && typeof input.isActive !== 'boolean') {
    return { error: 'وضعیت فعال بودن نامعتبر است.' };
  }

  const data: { kind?: string; title?: string; content?: string; isActive?: boolean } = {};
  if (kindDef) {
    data.kind = kindDef.kind;
  }
  if (typeof input.title === 'string') {
    data.title = input.title.trim();
  }
  if (typeof input.content === 'string') {
    data.content = input.content.trim();
  }
  if (typeof input.isActive === 'boolean') {
    data.isActive = input.isActive;
  }

  // Create requires both identifying fields; update only touches what's sent.
  if (!id && (data.title === undefined || data.content === undefined)) {
    return { error: 'عنوان و محتوای کد متا الزامی است.' };
  }

  const row = id
    ? await prisma.metaTag.update({ where: { id }, data })
    : await prisma.metaTag.create({
        data: {
          kind: effectiveKind,
          title: data.title ?? '—',
          content: data.content ?? '',
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
      });

  return { tag: toDTO(row) };
}

/** Removes one slot. */
export async function deleteMetaTag(id: string): Promise<void> {
  await prisma.metaTag.deleteMany({ where: { id } });
}
