'use client';

import {
  IconCalculator,
  IconCalendarStats,
  IconCategory,
  IconCoins,
  IconCreditCard,
  IconFileAlert,
  IconHeadset,
  IconHistory,
  IconIdBadge2,
  IconLayoutDashboard,
  IconMessage,
  IconPackage,
  IconSettings,
  IconShieldLock,
  IconShoppingCart,
  IconTemplate,
  IconTicket,
  IconTrendingUp,
  IconTruck,
  IconUsers,
  IconWorld,
  type Icon,
} from '@tabler/icons-react';

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  /** Optional count shown as a badge. */
  badge?: number;
}

export interface NavGroup {
  /** Group heading — the parent row of a collapsible sub-menu. */
  id: string;
  label: string;
  icon: Icon;
  /** Optional count shown as a badge. */
  badge?: number;
  children: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

export { isGroup };

export const NAV_ENTRIES: NavEntry[] = [
  { href: '/dashboard', label: 'داشبورد', icon: IconLayoutDashboard },
  { href: '/orders', label: 'سفارش‌ها', icon: IconShoppingCart, badge: 12 },
  {
    id: 'products',
    label: 'کالا',
    icon: IconPackage,
    children: [
      { href: '/products', label: 'محصولات', icon: IconPackage },
      { href: '/settings/categories', label: 'دسته‌بندی کالا', icon: IconCategory },
    ],
  },
  { href: '/customers', label: 'مشتریان', icon: IconUsers },
  { href: '/support', label: 'پشتیبانی', icon: IconHeadset },
  {
    id: 'people',
    label: 'مدیریت کاربران',
    icon: IconIdBadge2,
    children: [
      { href: '/users', label: 'کاربران', icon: IconUsers },
      { href: '/roles', label: 'نقش‌ها', icon: IconIdBadge2 },
    ],
  },

  {
    id: 'finance',
    label: 'مالی',
    icon: IconCoins,
    children: [
      { href: '/coupons', label: 'کد تخفیف‌', icon: IconTicket },
      { href: '/accounting', label: 'حسابداری', icon: IconCalculator },
      { href: '/payments', label: 'تراکنشهای درگاه', icon: IconCreditCard },
      { href: '/price-updates', label: 'به‌روزرسانی قیمت', icon: IconTrendingUp },
      { href: '/price-history', label: 'تاریخچه تغییر قیمت', icon: IconHistory },
    ],
  },
  {
    id: 'website',
    label: 'وبسایت',
    icon: IconWorld,
    children: [
      { href: '/settings/theme', label: 'تنظیمات قالب', icon: IconCategory },
      { href: '/settings/site', label: 'مشخصات سایت', icon: IconWorld },
      { href: '/settings/meta', label: 'متادیتا', icon: IconCategory },
    ],
  },
  {
    id: 'settings',
    label: 'تنظیمات',
    icon: IconSettings,
    children: [
      { href: '/settings', label: 'حساب و نمایش', icon: IconSettings },
      { href: '/settings/payment', label: 'درگاه پرداخت', icon: IconCreditCard },
      { href: '/settings/bnpl', label: 'درگاه اقساطی', icon: IconCalendarStats },
      { href: '/settings/sms', label: 'پنل پیامکی', icon: IconMessage },
      { href: '/settings/sms-templates', label: 'الگوهای پیامکی', icon: IconTemplate },
      { href: '/settings/shahkar', label: 'شاهکار', icon: IconIdBadge2 },
      { href: '/settings/security', label: 'امنیت سامانه', icon: IconShieldLock },
      { href: '/settings/shipping', label: 'روشهای ارسال', icon: IconTruck },
      { href: '/settings/support', label: 'پشتیبانی', icon: IconHeadset },
      { href: '/logs', label: 'لاگهای سیستمی', icon: IconFileAlert },
    ],
  },
];

/** Flat list kept for anything that still wants the old single-level shape. */
export const NAV_ITEMS: NavItem[] = NAV_ENTRIES.map((entry) =>
  isGroup(entry)
    ? { href: entry.children[0].href, label: entry.label, icon: entry.icon, badge: entry.badge }
    : entry
);
