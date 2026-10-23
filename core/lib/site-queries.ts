/**
 * گزارشات Cross-site — پنل Core دیتای هر سایت را از **API خود فروشگاه**
 * می‌خواند (GET /api/core/reports/[kind] با کلید x-core-key و هدر
 * x-site-domain). هیچ دسترسی مستقیمی به فایل/دیتابیس سایت‌ها وجود ندارد —
 * قاعده تبادل دیتا بین پنل Core و داشبورد فروشگاه.
 *
 *  ۱. محصولات تعریف‌شده‌ی هر سایت
 *  ۲. خلاصه فروش هر کالا در هر سایت
 *  ۳. مجموع فروش به تفکیک سایت در ماه (برچسب شمسی ستون month سفارش)
 *  ۴. درآمد آلازکور = commissionPercent دامنه (دیتابیس خود Core) × فروش
 *
 * فیلترها: تاریخ (createdAt)، دامنه، گروه کالا و نام کالا. «فروش» =
 * سفارش‌های غیر pending/cancelled (همان تعریف lib/reports.ts فروشگاه).
 * هر سایت مستقل خوانده می‌شود تا یک سایتِ در-دسترس-نبودن کل گزارش را نشکند.
 */

import prisma from './db';
import { shopApi } from './shop-api';

export interface ReportFilters {
  domain?: string;
  /** yyyy-mm-dd — روی createdAt سفارش‌ها. */
  from?: string;
  to?: string;
  categoryId?: string;
  productName?: string;
}

export interface SiteOption {
  domain: string;
  ready: boolean;
}

interface DomainsCacheRow {
  domain: string;
  dbName: string | null;
  dbStatus: string | null;
  commissionPercent: number;
}

let domainsCache: DomainsCacheRow[] = [];

async function refreshDomainsCache(): Promise<void> {
  domainsCache = await prisma.domain.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { domain: true, dbName: true, dbStatus: true, commissionPercent: true },
  });
}

export async function listSiteOptions(): Promise<SiteOption[]> {
  await refreshDomainsCache();
  return domainsCache.map((d) => ({
    domain: d.domain,
    // «ready» فقط وضعیت provision خود Core است — چک فایل فروشگاه ممنوع.
    ready: Boolean(d.dbName && d.dbStatus === 'ready'),
  }));
}

function resolveTargetDomains(filters: ReportFilters): DomainsCacheRow[] {
  return domainsCache.filter((d) => !filters.domain || d.domain === filters.domain);
}

function shopQuery(filters: ReportFilters): Record<string, string | undefined> {
  return {
    from: filters.from,
    to: filters.to,
    categoryId: filters.categoryId,
    productName: filters.productName,
  };
}

interface SiteCategoriesResponse {
  categories: { id: string; name: string }[];
}

/** دسته‌های کالای یک سایت — برای فیلتر گروه کالا (نیازمند انتخاب دامنه). */
export async function listSiteCategories(domain: string): Promise<{ id: string; name: string }[]> {
  const data = await shopApi<SiteCategoriesResponse>('/api/core/reports/categories', { domain });
  return data?.categories ?? [];
}

// ── ۱) محصولات تعریف‌شده هر سایت ──────────────────────────────────────────

export interface SiteProductsReport {
  domain: string;
  productCount: number;
  sample: string[];
  error?: string;
}

interface ProductsResponse {
  productCount: number;
  sample: string[];
}

export async function reportProducts(filters: ReportFilters): Promise<SiteProductsReport[]> {
  await refreshDomainsCache();
  const out: SiteProductsReport[] = [];
  for (const target of resolveTargetDomains(filters)) {
    const data = await shopApi<ProductsResponse>('/api/core/reports/products', {
      domain: target.domain,
      query: shopQuery(filters),
    });
    out.push(
      data
        ? { domain: target.domain, productCount: data.productCount, sample: data.sample }
        : { domain: target.domain, productCount: 0, sample: [], error: 'سرویس فروشگاه پاسخ نداد' }
    );
  }
  return out;
}

// ── ۲) فروش هر کالا ───────────────────────────────────────────────────────

export interface SiteProductSales {
  domain: string;
  items: { name: string; qty: number; revenue: number }[];
  total: number;
  error?: string;
}

interface ProductSalesResponse {
  items: { name: string; qty: number; revenue: number }[];
  total: number;
}

export async function reportProductSales(filters: ReportFilters): Promise<SiteProductSales[]> {
  await refreshDomainsCache();
  const out: SiteProductSales[] = [];
  for (const target of resolveTargetDomains(filters)) {
    const data = await shopApi<ProductSalesResponse>('/api/core/reports/product-sales', {
      domain: target.domain,
      query: shopQuery(filters),
    });
    out.push(
      data
        ? { domain: target.domain, items: data.items, total: data.total }
        : { domain: target.domain, items: [], total: 0, error: 'سرویس فروشگاه پاسخ نداد' }
    );
  }
  return out;
}

// ── ۳) فروش ماهانه ────────────────────────────────────────────────────────

export interface SiteMonthlySales {
  domain: string;
  months: { month: string; orders: number; total: number }[];
  total: number;
  error?: string;
}

interface MonthlySalesResponse {
  months: { month: string; orders: number; total: number }[];
  total: number;
}

export async function reportMonthlySales(filters: ReportFilters): Promise<SiteMonthlySales[]> {
  await refreshDomainsCache();
  const out: SiteMonthlySales[] = [];
  for (const target of resolveTargetDomains(filters)) {
    const data = await shopApi<MonthlySalesResponse>('/api/core/reports/monthly-sales', {
      domain: target.domain,
      query: shopQuery(filters),
    });
    out.push(
      data
        ? { domain: target.domain, months: data.months, total: data.total }
        : { domain: target.domain, months: [], total: 0, error: 'سرویس فروشگاه پاسخ نداد' }
    );
  }
  return out;
}

// ── ۴) درآمد آلازکور ──────────────────────────────────────────────────────

export interface SiteRevenueRow {
  domain: string;
  totalSales: number;
  commissionPercent: number;
  revenue: number;
  error?: string;
}

interface SalesResponse {
  totalSales: number;
}

export async function reportRevenue(filters: ReportFilters): Promise<{
  rows: SiteRevenueRow[];
  totalRevenue: number;
}> {
  await refreshDomainsCache();
  const rows: SiteRevenueRow[] = [];
  for (const target of resolveTargetDomains(filters)) {
    const data = await shopApi<SalesResponse>('/api/core/reports/sales', {
      domain: target.domain,
      query: shopQuery(filters),
    });
    if (!data) {
      rows.push({
        domain: target.domain,
        totalSales: 0,
        commissionPercent: target.commissionPercent,
        revenue: 0,
        error: 'سرویس فروشگاه پاسخ نداد',
      });
      continue;
    }
    rows.push({
      domain: target.domain,
      totalSales: data.totalSales,
      commissionPercent: target.commissionPercent,
      revenue: Math.round((data.totalSales * target.commissionPercent) / 100),
    });
  }
  return { rows, totalRevenue: rows.reduce((sum, row) => sum + row.revenue, 0) };
}
