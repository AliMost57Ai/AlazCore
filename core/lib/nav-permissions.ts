/**
 * کاتالوگ مجوز منوهای پنل Core — هم‌سان lib/nav-permissions.ts فروشگاه.
 * free of React/Prisma تا در proxy، API و UI یکی مصرف شود.
 */

export type MenuAction = 'view' | 'edit' | 'add';

export const MENU_ACTION_LABELS: Record<MenuAction, string> = {
  view: 'مشاهده',
  edit: 'اصلاح',
  add: 'افزودن',
};

/** منوهای قابل واگذاری به نقش‌های سفارشی پنل Core. */
export const CORE_MENUS: { id: string; label: string; items: { href: string; label: string }[] }[] =
  [
    {
      id: 'tenants',
      label: 'فروشگاه‌ها',
      items: [
        { href: '/panel/domains', label: 'مدیریت دامین‌ها' },
        { href: '/panel/plans', label: 'مدیریت پلن‌ها' },
        { href: '/panel/templates', label: 'مدیریت تم‌ها' },
      ],
    },
    {
      id: 'pay-sms',
      label: 'درگاه و پیامک',
      items: [
        { href: '/panel/gateways', label: 'مدیریت درگاه‌ها' },
        { href: '/panel/bnpl', label: 'مدیریت درگاه‌های اقساطی' },
        { href: '/panel/sms-panels', label: 'مدیریت پنل پیامکی' },
      ],
    },
    {
      id: 'reports',
      label: 'گزارشات',
      items: [
        { href: '/panel/reports/products', label: 'محصولات هر سایت' },
        { href: '/panel/reports/product-sales', label: 'فروش هر کالا' },
        { href: '/panel/reports/monthly-sales', label: 'فروش ماهانه سایت‌ها' },
        { href: '/panel/reports/revenue', label: 'درآمد آلازکور' },
        { href: '/panel/reports/renewals', label: 'گزارش تمدیدها' },
      ],
    },
    {
      id: 'support',
      label: 'پشتیبانی',
      items: [{ href: '/panel/tickets', label: 'تیکت‌های پشتیبانی' }],
    },
    {
      id: 'administration',
      label: 'مدیریت سامانه',
      items: [
        { href: '/panel/users', label: 'کاربران Core' },
        { href: '/panel/roles', label: 'نقش‌ها' },
        { href: '/panel/settings', label: 'تنظیمات سامانه' },
      ],
    },
  ];

export const CORE_HREFS: string[] = CORE_MENUS.flatMap((group) =>
  group.items.map((item) => item.href)
);

/**
 * قابلیت‌های ویژه پنل Core — مجوزهایی که صفحه نیستند ولی واگذارشدنی‌اند؛
 * مثل حق فعال‌سازی خالی‌فروشی یک دامنه در فرم مدیریت دامین‌ها. فضای نام
 * cap: باعث می‌شود hasCorePermission مشاهده منو را از قابلیت استنتاج نکند. در همان
 * آرایه permissions نقش ذخیره می‌شوند و در فرم نقش‌ها چک‌باکس مستقل دارند.
 */
export interface CoreCapabilityGrant {
  entry: string;
  label: string;
  description: string;
}

export const CORE_CAPABILITIES: CoreCapabilityGrant[] = [
  {
    entry: 'cap:domain-oversell',
    label: 'فعال‌سازی خالی‌فروشی دامنه',
    description: 'نمایش و تغییر «خالی‌فروشی مجاز» و سقف کل فروشگاه در فرم تعریف/ویرایش دامنه.',
  },
];

export const CORE_CAPABILITY_ENTRIES: string[] = CORE_CAPABILITIES.map((item) => item.entry);

export const CORE_PERMISSIONS: string[] = [
  ...CORE_HREFS.flatMap((href) => [href, `${href}:edit`, `${href}:add`]),
  ...CORE_CAPABILITY_ENTRIES,
];

/** آیا فهرست مجوزها قابلیت مشخصی را دارد؟ ('*' رد می‌شود) */
export function hasCoreCapability(perms: string[] | undefined, entry: string): boolean {
  if (!perms) {
    return false;
  }
  return perms.includes('*') || perms.includes(entry);
}

/** صفحات همیشه قابل مشاهده برای هر نشست معتبر. */
export const CORE_ALWAYS_VISIBLE: string[] = ['/panel'];

export function hrefMatches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function matchingCoreHref(pathname: string): string | null {
  return CORE_HREFS.find((href) => hrefMatches(pathname, href)) ?? null;
}

export function hasCorePermission(
  perms: string[] | undefined,
  href: string,
  action: MenuAction = 'view'
): boolean {
  if (!perms) {
    return false;
  }
  if (perms.includes('*')) {
    return true;
  }
  if (action === 'view') {
    return perms.some((entry) => entry === href || entry.startsWith(`${href}:`));
  }
  return perms.includes(`${href}:${action}`);
}
