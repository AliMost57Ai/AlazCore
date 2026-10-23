import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/auth';
import {
  listSiteCategories,
  reportMonthlySales,
  reportProductSales,
  reportProducts,
  reportRevenue,
  type ReportFilters,
} from '@/lib/site-queries';
import {
  monthlySalesWorkbook,
  productSalesWorkbook,
  productsWorkbook,
  revenueWorkbook,
} from '@/lib/report-export';

/**
 * GET /api/reports/[kind]/export — خروجی اکسل سند رسمی هر گزارش.
 * kind: products | product-sales | monthly-sales | revenue
 * فیلترها از query string (همان گزارش صفحه).
 */

const KINDS = ['products', 'product-sales', 'monthly-sales', 'revenue'] as const;
type Kind = (typeof KINDS)[number];

const MENU_BY_KIND: Record<Kind, string> = {
  products: '/panel/reports/products',
  'product-sales': '/panel/reports/product-sales',
  'monthly-sales': '/panel/reports/monthly-sales',
  revenue: '/panel/reports/revenue',
};

const FILENAMES: Record<Kind, string> = {
  products: 'alazcore-products-report',
  'product-sales': 'alazcore-product-sales-report',
  'monthly-sales': 'alazcore-monthly-sales-report',
  revenue: 'alazcore-revenue-report',
};

export async function GET(request: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!KINDS.includes(kind as Kind)) {
    return NextResponse.json({ error: 'نوع گزارش ناشناخته است.' }, { status: 404 });
  }
  const session = await requireApiMenu(MENU_BY_KIND[kind as Kind]);
  if (session instanceof Response) {
    return session;
  }

  const q = request.nextUrl.searchParams;
  const filters: ReportFilters = {
    domain: q.get('domain') ?? undefined,
    from: q.get('from') ?? undefined,
    to: q.get('to') ?? undefined,
    categoryId: q.get('categoryId') ?? undefined,
    productName: q.get('productName') ?? undefined,
  };
  const meta = { from: filters.from, to: filters.to, productName: filters.productName };
  if (kind !== 'products' && filters.categoryId && filters.domain) {
    // نام گروه در سند بیاید — دسته‌ها را برای نمایش برچسب می‌خوانیم (اختیاری).
  }

  let buffer: Buffer;
  try {
    if (kind === 'products') {
      buffer = await productsWorkbook(await reportProducts(filters), meta);
    } else if (kind === 'product-sales') {
      buffer = await productSalesWorkbook(await reportProductSales(filters), meta);
    } else if (kind === 'monthly-sales') {
      buffer = await monthlySalesWorkbook(await reportMonthlySales(filters), meta);
    } else {
      const report = await reportRevenue(filters);
      buffer = await revenueWorkbook(report.rows, meta);
    }
  } catch (error) {
    return NextResponse.json(
      { error: `تولید اکسل ناموفق بود: ${(error as Error).message}` },
      { status: 500 }
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${FILENAMES[kind as Kind]}-${Date.now()}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
