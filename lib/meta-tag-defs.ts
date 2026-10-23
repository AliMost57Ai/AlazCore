/**
 * Client-safe definitions of the meta-tag slot kinds — pure data/types with
 * NO server imports, so client components (MetaTagsManager) can import them
 * without pulling prisma/next-headers into the client bundle. Server logic
 * lives in lib/meta-tags.ts which re-exports from here.
 */

export type MetaTagKind = 'ga4' | 'gtm' | 'gsc' | 'clarity' | 'custom';

export interface MetaTagKindDef {
  kind: MetaTagKind;
  label: string;
  /** Persian hint shown under the form input. */
  hint: string;
  /** The strict pattern the content must match (validation + defense). */
  pattern: RegExp;
  /** Persian error shown when the content does not match. */
  error: string;
}

/**
 * The five supported slot kinds. The custom slot still only allows a plain
 * <meta> tag shape — <script>/<iframe>/event handlers are impossible by
 * construction.
 */
export const META_TAG_KINDS: MetaTagKindDef[] = [
  {
    kind: 'ga4',
    label: 'Google Analytics (GA4)',
    hint: 'شناسه اندازه‌گیری مثل G-ABC12DEF34 یا UA-12345678-1',
    pattern: /^(G-[A-Za-z0-9_-]{4,20}|UA-\d{4,12}-\d{1,4})$/,
    error: 'شناسه Google Analytics باید به شکل G-XXXX… یا UA-… باشد.',
  },
  {
    kind: 'gtm',
    label: 'Google Tag Manager',
    hint: 'شناسه کانتینر مثل GTM-ABC12DE',
    pattern: /^GTM-[A-Za-z0-9_-]{4,15}$/,
    error: 'شناسه Tag Manager باید به شکل GTM-XXXX… باشد.',
  },
  {
    kind: 'gsc',
    label: 'تاییدیه Google Search Console',
    hint: 'محتوای متاتگ، مثل google-site-verification=… از HTML پیشنهادی',
    pattern: /^[A-Za-z0-9+=_-]{16,120}$/,
    error: 'کد تاییدیه Search Console معتبر نیست.',
  },
  {
    kind: 'clarity',
    label: 'Microsoft Clarity',
    hint: 'شناسه پروژه، مثل 5abcdefghijklmnopqrstuvwxyz0 (۲۵ نویسه)',
    pattern: /^[A-Za-z0-9_-]{8,40}$/,
    error: 'شناسه پروژه Clarity معتبر نیست.',
  },
  {
    kind: 'custom',
    label: 'متاتگ دلخواه',
    hint: 'به شکل «name=مقدار|content=مقدار» — فقط متاتگ؛ اسکریپت مجاز نیست.',
    pattern: /^[^\n<>]{3,200}\|[^\n<>]{3,300}$/,
    error: 'متاتگ دلخواه باید به شکل «name=…|content=…» و بدون علامت < و > باشد.',
  },
];

export const META_TAG_KIND_MAP: Record<MetaTagKind, MetaTagKindDef> = META_TAG_KINDS.reduce(
  (map, def) => ({ ...map, [def.kind]: def }),
  {} as Record<MetaTagKind, MetaTagKindDef>
);
