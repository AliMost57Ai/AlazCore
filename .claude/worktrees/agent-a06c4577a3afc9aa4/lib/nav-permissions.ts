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
    id: 'operations',
    label: 'عملیات فروشگاه',
    items: [
      { href: '/orders', label: 'سفارش‌ها' },
      { href: '/customers', label: 'مشتریان' },
      // A permission token, not a page: nothing is served at /customers/file.
      // It marks who may open a customer FILE (/customers/[id]) without also
      // handing them the customer list — the supporter case. Everybody holding
      // '/customers' gets the file too; see ALTERNATE_GRANTS below.
      { href: '/customers/file', label: 'مشاهدهٔ پروندهٔ مشتری' },
      { href: '/support', label: 'تیکت‌های پشتیبانی' },
    ],
  },
  {
    id: 'products',
    label: 'کالا',
    items: [
      { href: '/products', label: 'محصولات' },
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
      // A top-level route on purpose: hrefMatches is prefix-based, so nesting
      // it under /price-updates would hand the history page to anyone holding
      // the update menu — and the whole point is granting them separately.
      { href: '/price-history', label: 'تاریخچه تغییر قیمت' },
    ],
  },
  {
    id: 'website',
    label: 'وبسایت',
    items: [
      { href: '/settings/theme', label: 'تنظیمات قالب' },
      { href: '/settings/site', label: 'مشخصات سایت' },
      { href: '/settings/meta', label: 'متادیتا' },
    ],
  },
];

/** Flat list of every grantable href — the base of the permission validation set. */
export const ASSIGNABLE_HREFS: string[] = ASSIGNABLE_MENUS.flatMap((group) =>
  group.items.map((item) => item.href)
);

/** Every valid permission entry: a bare href (view) plus href:edit / href:add. */
export const ASSIGNABLE_PERMISSIONS: string[] = ASSIGNABLE_HREFS.flatMap((href) => [
  href,
  `${href}:edit`,
  `${href}:add`,
]);

/**
 * href → Persian label. The reverse of ASSIGNABLE_MENUS: it turns a stored
 * permission list back into the words the admin ticked, which is what the
 * system log shows when a role's access changes.
 */
export const MENU_LABELS: Record<string, string> = Object.fromEntries(
  ASSIGNABLE_MENUS.flatMap((group) => group.items.map((item) => [item.href, item.label]))
);

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
  '/settings/support',
];

/**
 * Pages every signed-in staff member may open and see in the sidebar,
 * permission lists aside. (A page can be open to everyone and still be kept
 * out of the sidebar — see ADMIN_ONLY_ROW_HREFS below.)
 */
export const ALWAYS_VISIBLE_HREFS: string[] = ['/dashboard', '/settings'];

/**
 * Grants that are permission tokens rather than pages: the href names a
 * capability, and nothing is served at it. Never render one as a link.
 */
export const TOKEN_ONLY_HREFS: string[] = ['/customers/file'];

/**
 * Menu rows only an administrator is shown.
 *
 * Not the same thing as ADMIN_ONLY_HREFS, where the *page* is refused to
 * non-admins. /dashboard stays open to every signed-in user, because it is
 * where the sign-in form lands people and where every refused page redirects —
 * a page that bounced non-admins would turn those redirects into a loop. The
 * dashboard itself draws its charts only for admins (app/(app)/dashboard), so
 * this constant merely keeps a row leading to a page with nothing of theirs on
 * it out of a staff member's sidebar. Only the sidebar reads it; the guards do
 * not, and must not.
 */
export const ADMIN_ONLY_ROW_HREFS: string[] = ['/dashboard'];

/**
 * Pages more than one grant opens.
 *
 * proxy.ts resolves a pathname to a *single* menu href by prefix
 * (matchingAssignableHref), which is right for every page that lives inside one
 * menu — but wrong for the customer file at /customers/[id], which two
 * different grants open: the customer list ('/customers') and the standalone
 * «مشاهدهٔ پروندهٔ مشتری» token ('/customers/file') that a supporter can hold
 * without ever seeing the customer list.
 *
 * The key is a prefix ending in '/' so the list page itself (/customers) keeps
 * its plain, single-grant requirement — holding only the file token must not
 * unlock the list.
 */
export const ALTERNATE_GRANTS: { prefix: string; anyOf: string[] }[] = [
  { prefix: '/customers/', anyOf: ['/customers', '/customers/file'] },
];

/** True when `pathname` sits under `href` (exact match or sub-route). */
export function hrefMatches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The ADMIN_ONLY_HREFS entry covering this pathname, if any. */
export function matchingAdminOnlyHref(pathname: string): string | null {
  return ADMIN_ONLY_HREFS.find((href) => hrefMatches(pathname, href)) ?? null;
}

/** The ASSIGNABLE_HREFS entry covering this pathname, if any. */
export function matchingAssignableHref(pathname: string): string | null {
  return ASSIGNABLE_HREFS.find((href) => hrefMatches(pathname, href)) ?? null;
}

/** The grants that open this pathname, or null when it needs no specific one. */
export function matchingAlternateGrants(pathname: string): string[] | null {
  return ALTERNATE_GRANTS.find((entry) => pathname.startsWith(entry.prefix))?.anyOf ?? null;
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
