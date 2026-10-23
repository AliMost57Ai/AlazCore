'use client';

import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconCalculator,
  IconCalendarStats,
  IconCash,
  IconCategory,
  IconChartBar,
  IconCoins,
  IconCreditCard,
  IconFileAlert,
  IconHeadset,
  IconHelpCircle,
  IconIdBadge2,
  IconLayoutDashboard,
  IconListDetails,
  IconMapPin,
  IconMessage,
  IconMessages,
  IconPackage,
  IconPackages,
  IconReportMoney,
  IconSettings,
  IconShieldLock,
  IconShoppingCart,
  IconTag,
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
  {
    id: 'orders',
    label: 'مدیریت سفارشات',
    icon: IconShoppingCart,
    children: [
      { href: '/orders', label: 'سفارش‌ها', icon: IconShoppingCart },
      { href: '/products/reorder-list', label: 'لیست خرید', icon: IconListDetails },
      { href: '/products/low-stock', label: 'رو به اتمام', icon: IconAlertTriangle },
      { href: '/products/oversell', label: 'خالی‌فروشی', icon: IconPackages },
      { href: '/orders/pickup', label: 'تحویل حضوری', icon: IconMapPin },
      { href: '/returns', label: 'مرجوعی کالا', icon: IconArrowBackUp },
    ],
  },
  {
    id: 'products',
    label: 'کالا',
    icon: IconPackage,
    children: [
      { href: '/products', label: 'محصولات', icon: IconPackage },
      { href: '/brands', label: 'برندها', icon: IconTag },
      { href: '/settings/categories', label: 'دسته‌بندی کالا', icon: IconCategory },
    ],
  },
  { href: '/customers', label: 'مشتریان', icon: IconUsers },
  { href: '/customer-support', label: 'پشتیبانی مشتریان', icon: IconMessages },
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
    ],
  },
  {
    id: 'financial-reports',
    label: 'گزارشات مالی',
    icon: IconReportMoney,
    children: [
      { href: '/reports/summary', label: 'خلاصه مالی دوره', icon: IconChartBar },
      { href: '/reports/coupons', label: 'کدهای تخفیف', icon: IconTicket },
      { href: '/reports/commission', label: 'کارمزد AlazCore', icon: IconCoins },
      { href: '/reports/cash-flow', label: 'جریان نقدی', icon: IconCash },
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
      { href: '/settings/faq', label: 'سوالات متداول', icon: IconHelpCircle },
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
      { href: '/settings/pickup', label: 'مدیریت تحویل حضوری', icon: IconMapPin },
      { href: '/settings/returns', label: 'مرجوعی کالا', icon: IconArrowBackUp },
      { href: '/settings/support', label: 'پشتیبانی آنلاین', icon: IconHeadset },
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
