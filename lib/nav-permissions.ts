/**
 * The admin-panel menu permission catalog.
 *
 * Roles (lib/roles.ts) grant staff their panel access as a list of permission
 * entries picked from ASSIGNABLE_MENUS — e.g. a کارمند انبار role holds
 * /products:add and /products:edit. Each page grants three actions:
 *  - 'view' — open the page and read its data (stored as the bare href),
 *  - 'edit' — change or delete existing rows (/products:edit),
 *  - 'add'  — create new rows (/products:add).
 * 'edit'/'add' imply 'view'. Pages outside this catalog are either personal
 * (dashboard, own settings — everyone signed in) or admin-only
 * (ADMIN_ONLY_HREFS — managing users/roles and the credential-heavy
 * settings pages, whose shared API /api/admin/settings stays admin-gated).
 *
 * Deliberately free of React, icons and Prisma so the same constants load in
 * the Edge middleware (proxy.ts), server components, API routes and the
 * client-side nav (nav-items.ts / NavLinks.tsx).
 */

/** The actions a role may be granted on a page. */
export type MenuAction = 'view' | 'edit' | 'add';

/** Persian labels for the role form's per-page action checkboxes. */
export const MENU_ACTION_LABELS: Record<MenuAction, string> = {
  view: 'مشاهده',
  edit: 'اصلاح',
  add: 'افزودن',
};

/** One grantable menu entry. */
export interface MenuPermissionItem {
  href: string;
  label: string;
}

/** One grantable menu group — mirrors a sidebar group. */
export interface MenuPermissionGroup {
  id: string;
  label: string;
  items: MenuPermissionItem[];
}

/** Menus a role may be granted. Keep the hrefs in sync with nav-items.ts. */
export const ASSIGNABLE_MENUS: MenuPermissionGroup[] = [
  {
    id: 'orders',
    label: 'مدیریت سفارشات',
    items: [
      { href: '/orders', label: 'سفارش‌ها' },
      { href: '/products/reorder-list', label: 'لیست خرید' },
      { href: '/products/low-stock', label: 'رو به اتمام' },
      { href: '/products/oversell', label: 'خالی‌فروشی' },
      { href: '/orders/pickup', label: 'تحویل حضوری' },
      { href: '/returns', label: 'مرجوعی کالا' },
    ],
  },
  {
    id: 'operations',
    label: 'عملیات فروشگاه',
    items: [
      { href: '/customers', label: 'مشتریان' },
      // توکن دسترسی است نه صفحه: چیزی در /customers/file سرو نمی‌شود. نشان
      // می‌دهد چه کسی می‌تواند پروندهٔ مشتری (/customers/[id]) را باز کند بدون
      // این‌که لیست مشتریان را هم ببیند — حالت پشتیبان. دارندگان '/customers'
      // پرونده را هم دارند؛ ALTERNATE_GRANTS پایین.
      { href: '/customers/file', label: 'مشاهدهٔ پروندهٔ مشتری' },
      { href: '/customer-support', label: 'پشتیبانی مشتریان' },
    ],
  },
  {
    id: 'products',
    label: 'کالا',
    items: [
      { href: '/products', label: 'محصولات' },
      { href: '/brands', label: 'برندها' },
      { href: '/settings/categories', label: 'دسته‌بندی کالا' },
    ],
  },
  {
    id: 'finance',
    label: 'مالی',
    items: [
      { href: '/coupons', label: 'کد تخفیف' },
      { href: '/accounting', label: 'حسابداری' },
      { href: '/payments', label: 'تراکنشهای درگاه' },
      { href: '/price-updates', label: 'به‌روزرسانی قیمت' },
    ],
  },
  {
    id: 'financial-reports',
    label: 'گزارشات مالی',
    items: [
      { href: '/reports/summary', label: 'خلاصه مالی دوره' },
      { href: '/reports/coupons', label: 'کدهای تخفیف' },
      { href: '/reports/commission', label: 'کارمزد AlazCore' },
      { href: '/reports/cash-flow', label: 'جریان نقدی' },
    ],
  },
  {
    id: 'website',
    label: 'وبسایت',
    items: [
      { href: '/settings/theme', label: 'تنظیمات قالب' },
      { href: '/settings/site', label: 'مشخصات سایت' },
      { href: '/settings/meta', label: 'متادیتا' },
      { href: '/settings/faq', label: 'سوالات متداول' },
    ],
  },
];

/** Flat list of every grantable href — the base of the permission validation set. */
export const ASSIGNABLE_HREFS: string[] = ASSIGNABLE_MENUS.flatMap((group) =>
  group.items.map((item) => item.href)
);

/**
 * href → Persian label, for callers that must word a granted page without
 * importing the React nav (the dashboard welcome a staff member lands on).
 * Built from the same catalog the /roles page reads so the words cannot drift;
 * staff pages that are not grantable menu entries are listed explicitly.
 */
export const MENU_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    ASSIGNABLE_MENUS.flatMap((group) =>
      group.items.map((item): [string, string] => [item.href, item.label])
    )
  ),
  '/support': 'تیکت‌های پشتیبانی',
};

/**
 * Capability grants — not pages but feature switches a role may hold, e.g.
 * the right to configure خالی‌فروشی on products. The cap: namespace
 * keeps them out of the menu-view implication in hasMenuPermission. Stored in the same
 * permissions array as menu hrefs; shown in the roles form as standalone
 * checkboxes (the roles page filters this list by the site's license).
 */
export interface CapabilityGrant {
  /** The permission entry stored on the role. */
  entry: string;
  label: string;
  description: string;
}

export const ASSIGNABLE_CAPABILITIES: CapabilityGrant[] = [
  {
    entry: 'cap:product-oversell',
    label: 'خالی‌فروشی کالا',
    description:
      'اجازه فعال/غیرفعال کردن خالی‌فروشی هر کالا و تعیین تعداد آن (۱ تا سقف مجاز فروشگاه) — فروش کالای تمام‌شده تا سقف تعیین‌شده.',
  },
];

/** The capability entries alone — merged into the valid permission set below. */
export const CAPABILITY_ENTRIES: string[] = ASSIGNABLE_CAPABILITIES.map((item) => item.entry);

/** Every valid permission entry: a bare href (view) plus href:edit / href:add. */
export const ASSIGNABLE_PERMISSIONS: string[] = [
  ...ASSIGNABLE_HREFS.flatMap((href) => [href, `${href}:edit`, `${href}:add`]),
  ...CAPABILITY_ENTRIES,
];

/** Whether a permission list holds a capability entry ('*' passes). */
export function hasCapability(perms: string[] | undefined, entry: string): boolean {
  if (!perms) {
    return false;
  }
  return perms.includes('*') || perms.includes(entry);
}

/**
 * Admin-only pages: user/role management, system logs and the settings pages
 * that share the credentials API (/api/admin/settings). Not grantable — only
 * roles flagged isAdmin (or the 'admin' built-in) reach them.
 */
export const ADMIN_ONLY_HREFS: string[] = [
  '/users',
  '/roles',
  '/logs',
  '/settings/payment',
  '/settings/bnpl',
  '/settings/sms',
  '/settings/sms-templates',
  '/settings/shahkar',
  '/settings/security',
  '/settings/shipping',
  '/settings/returns',
  '/settings/support',
];

/** Pages every signed-in staff member sees, permission lists aside. */
export const ALWAYS_VISIBLE_HREFS: string[] = ['/dashboard', '/settings'];

/**
 * Grants that are permission tokens rather than pages: the href names a
 * capability, and nothing is served at it. Never render one as a nav link.
 */
export const TOKEN_ONLY_HREFS: string[] = ['/customers/file'];

/**
 * Pages more than one grant opens.
 *
 * proxy.ts resolves a pathname to a single menu href by prefix
 * (matchingAssignableHref) — right for every page inside one menu, wrong for
 * the customer file at /customers/[id], which two different grants open: the
 * customer list ('/customers') and the standalone «مشاهدهٔ پروندهٔ مشتری»
 * token ('/customers/file') a supporter can hold without ever seeing the
 * customer list.
 *
 * The key is a prefix ending in '/' so the list page itself (/customers)
 * keeps its plain single-grant requirement — holding only the file token must
 * not unlock the list.
 */
export const ALTERNATE_GRANTS: { prefix: string; anyOf: string[] }[] = [
  { prefix: '/customers/', anyOf: ['/customers', '/customers/file'] },
];

/** The grants that open this pathname, or null when it needs no specific one. */
export function matchingAlternateGrants(pathname: string): string[] | null {
  return ALTERNATE_GRANTS.find((entry) => pathname.startsWith(entry.prefix))?.anyOf ?? null;
}

/** True when `pathname` sits under `href` (exact match or sub-route). */
export function hrefMatches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The catalog entry covering this pathname — longest href wins, so
 * '/products/reorder-list' resolves to its own grant, not '/products'.
 */
function matchingHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (hrefMatches(pathname, href) && (best === null || href.length > best.length)) {
      best = href;
    }
  }
  return best;
}

/** The ADMIN_ONLY_HREFS entry covering this pathname, if any. */
export function matchingAdminOnlyHref(pathname: string): string | null {
  return matchingHref(pathname, ADMIN_ONLY_HREFS);
}

/** The ASSIGNABLE_HREFS entry covering this pathname, if any. */
export function matchingAssignableHref(pathname: string): string | null {
  return matchingHref(pathname, ASSIGNABLE_HREFS);
}

/**
 * Whether a permission list grants `action` on `href` (an exact menu href,
 * not a pathname). '*' passes everything; a bare href is a view grant and any
 * href:… entry also implies view — so '/products:edit' can read /products.
 */
export function hasMenuPermission(
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
